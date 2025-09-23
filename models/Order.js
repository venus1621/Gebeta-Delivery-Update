import mongoose from "mongoose";
import Food from "./Food.js";          
import Restaurant from '../models/restaurantModel.js';
import {computeDeliveryFee} from "../utils/computeDeliveryFee.js"; 

// --- Transaction sub-schema ---
const transactionSchema = new mongoose.Schema({
  totalPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: {
    type: String,
    enum: ["Pending", "Paid"],
    default: "Pending",
  },
  refId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

// --- Allowed order status transitions ---
const STATUS_FLOW = {
  Pending: ["Cooked", "Cancelled"],
  Preparing: ["Cooked", "Cancelled"],
  Cooked: ["Delivering", "Cancelled"],
  Delivering: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: []
};

// --- Order schema ---
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderItems: [
      {
        foodId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Food",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 },
        name: { type: String, required: true },
        foodImage: { type: String },
      },
    ],
    foodTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    deliveryFee: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    tip: { type: mongoose.Schema.Types.Decimal128, default: 0, min: 0 },
    totalPrice: { type: mongoose.Schema.Types.Decimal128, required: true },

    typeOfOrder: {
      type: String,
      enum: ["Delivery", "Takeaway"],
      default: "Delivery",
      required: true,
    },
    deliveryVehicle: {
      type: String,
      enum: ["Car", "Motor", "Bicycle"],
      required: function () {
        return this.typeOfOrder === "Delivery";
      },
    },
    distanceKm: { type: Number, default: 0, min: 0 },
    restaurantLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    destinationLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    description: { type: String },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "restaurantId is required"],
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Preparing", "Cooked", "Delivering", "Completed", "Cancelled"],
      default: "Pending",
      index: true,
    },

    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
    },

    orderCode: { type: String, unique: true, sparse: true },
    userVerificationCode: { type: String },
    deliveryVerificationCode: { type: String },
   

    transaction: {
      type: transactionSchema,
      required: true,
    },
  },
  { timestamps: true }
);

// --- Utility: Generate 6-digit verification code ---
const generateVerificationCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const generateOrderCode = async function() {
  const prefix = 'ORD';
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  const orderId = `${prefix}-${randomNum}`;
  const existingOrder = await this.findOne({ orderCode: orderId });
  if (existingOrder) {
    return generateOrderCode.call(this); // Recursively generate until unique
  }
  return orderId;
};
// --- Static method: validate & compute order ---
// --- Static method: validate & compute order ---
// --- Static method: validate & compute order ---
orderSchema.statics.validateAndComputeOrder = async function ({
  orderItems,
  typeOfOrder,
  deliveryVehicle,
  destinationLocation,
  tip,
  description,
}) {
  // --- Basic validation ---
  if (!orderItems || orderItems.length === 0) {
    throw new Error("No order items provided.");
  }

  if (!typeOfOrder || !["Delivery", "Takeaway"].includes(typeOfOrder)) {
    throw new Error('Invalid or missing typeOfOrder.');
  }

  if (typeOfOrder === "Delivery") {
    const allowedVehicles = ["Car", "Motor", "Bicycle"];
    if (!deliveryVehicle || !allowedVehicles.includes(deliveryVehicle)) {
      throw new Error(`Invalid deliveryVehicle for delivery orders.`);
    }
    if (
      !destinationLocation ||
      typeof destinationLocation.lat !== "number" ||
      typeof destinationLocation.lng !== "number"
    ) {
      throw new Error("Valid destination location coordinates are required for delivery orders.");
    }
  }

  // Parse and validate tip
  let parsedTip = 0;
  if (tip !== undefined && tip !== null) {
    // Handle both number and Decimal128 types
    if (typeof tip === "object" && tip.toString) {
      parsedTip = parseFloat(tip.toString());
    } else if (typeof tip === "number") {
      parsedTip = tip;
    } else if (typeof tip === "string") {
      parsedTip = parseFloat(tip);
    }
    
    if (isNaN(parsedTip) || parsedTip < 0) {
      throw new Error("Tip must be a non-negative number.");
    }
  }

  if (description && typeof description !== "string") {
    throw new Error("Description must be a string.");
  }

  // --- Food & restaurant validation ---
  let foodTotal = 0;
  let restaurantId = null;
  const normalizedOrderItems = [];

  const foodIds = orderItems.map((item) => item.foodId);
  const foods = await Food.find({ _id: { $in: foodIds } }).populate("menuId");
  const foodMap = new Map(foods.map((food) => [food._id.toString(), food]));

  for (const item of orderItems) {
    const food = foodMap.get(item.foodId.toString());
    if (!food) throw new Error(`Food item not found: ${item.foodId}`);
    if (!food.menuId?.restaurantId) {
      throw new Error(`Invalid menu data for food item: ${item.foodId}`);
    }

    const currentRestaurantId = food.menuId.restaurantId.toString();
    if (!restaurantId) {
      restaurantId = currentRestaurantId;
    } else if (restaurantId !== currentRestaurantId) {
      throw new Error("All items must be from the same restaurant.");
    }

    const priceNum = parseFloat(food.price.toString());
    foodTotal += priceNum * item.quantity;

    // ✅ Normalize order item with correct values
    normalizedOrderItems.push({
      foodId: food._id,
      quantity: item.quantity,
      price: mongoose.Types.Decimal128.fromString(priceNum.toFixed(2)),
      name: food.foodName,
      foodImage: food.image || "",
    });
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw new Error("Restaurant not found.");

  const restaurantLocation = {
    lat: restaurant.location.coordinates[1],
    lng: restaurant.location.coordinates[0],
  };

  // --- Delivery fee ---
  let deliveryFee = 0;
  let distanceKm = 0;

  if (typeOfOrder === "Delivery") {
    console.log(restaurantLocation, destinationLocation, deliveryVehicle);
    const { deliveryFee: computedFee, distanceKm: computedDistance } =
      await computeDeliveryFee({
        restaurantLocation,
        destinationLocation,
        deliveryVehicle,
      });
    deliveryFee = computedFee;
    distanceKm = computedDistance;
  }

  const totalPrice = foodTotal + deliveryFee + parsedTip;

  // ✅ Convert to Decimal128 before returning
  return {
    orderItems: normalizedOrderItems,
    foodTotal: mongoose.Types.Decimal128.fromString(foodTotal.toFixed(2)),
    restaurantId,
    deliveryFee: mongoose.Types.Decimal128.fromString(deliveryFee.toFixed(2)),
    distanceKm,
    tip: mongoose.Types.Decimal128.fromString(parsedTip.toFixed(2)),
    restaurantLocation,
    destinationLocation,
    deliveryVehicle,
    restaurantName: restaurant.name,
    totalPrice: mongoose.Types.Decimal128.fromString(totalPrice.toFixed(2)),
    typeOfOrder,
    description,
    orderCode: await generateOrderCode.call(this),
    userVerificationCode: generateVerificationCode(),
  };
};

// --- Pre-update hook: only allow orderStatus & deliveryId updates ---
// --- Pre-update hook: only allow orderStatus & deliveryId updates ---
orderSchema.pre("findOneAndUpdate", async function (next) {
  try {
    let update = this.getUpdate();
    if (!update) return next();

    // Normalize: always work with $set
    if (update.$set) {
      update = update.$set;
    }

    const docToUpdate = await this.model.findOne(this.getQuery());
    if (!docToUpdate) {
      return next(new Error("Order not found"));
    }

    // ✅ Only allow updating these fields
    const allowedFields = ["orderStatus", "deliveryId","updatedAt"];
    const invalidFields = Object.keys(update).filter(f => !allowedFields.includes(f));
    if (invalidFields.length > 0) {
      return next(
        new Error(`Cannot update fields: ${invalidFields.join(", ")} after order creation`)
      );
    }

    // ✅ Generate delivery verification code only if deliveryId changes
    if (update.deliveryId && update.deliveryId.toString() !== docToUpdate.deliveryId?.toString()) {
      update.deliveryVerificationCode = generateVerificationCode();
    }

    // ✅ Validate orderStatus flow
    if (update.orderStatus) {
      const currentStatus = docToUpdate.orderStatus;
      const newStatus = update.orderStatus;

      if (["Completed", "Cancelled"].includes(currentStatus)) {
        return next(new Error("Cannot change status of a completed or cancelled order"));
      }

      if (!STATUS_FLOW[currentStatus]?.includes(newStatus)) {
        return next(
          new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`)
        );
      }
    }

    // Re-apply sanitized update
    this.setUpdate({ $set: update });

    next();
  } catch (err) {
    next(err);
  }
});

// --- Pre-find hook: ignore unpaid orders ---
orderSchema.pre("find", function (next) {
  // Only return orders where transaction.Status = "Paid"
  this.where({ "transaction.status": "Paid" });
  next();
});

// (Optional) also for findOne
// --- Pre-find hook: ignore unpaid orders (except when explicitly bypassed)
orderSchema.pre(["find", "findOne"], function (next) {
  if (!this.getOptions().bypassPaidFilter) {
    this.where({ "transaction.status": "Paid" });
  }
  next();
});

export default mongoose.model("Order", orderSchema);