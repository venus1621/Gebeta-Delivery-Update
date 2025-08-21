// testRoutes.js
import express from "express";
import { getIO } from "../utils/socket.js";

const router = express.Router();

router.get("/test-socket", (req, res) => {
  const io = getIO();
  if (io) {
    io.to("deliveries").emit("order:cooked", {
      orderId: "TEST123",
      restaurantLocation: { lat: 9.03, lng: 38.74 },
      deliveryLocation: { lat: 9.05, lng: 38.75 },
      deliveryFee: 50,
      tip: 10,
      grandTotal: 60,
      createdAt: new Date(),
    });
    console.log("✅ Test event emitted!");
    return res.json({ message: "Socket test event emitted" });
  } else {
    return res.status(500).json({ error: "Socket not initialized" });
  }
});

export default router;
