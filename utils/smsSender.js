import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const sendSMS = async (to, message) => {
  try {
    const response = await axios.post('https://api.smsmode.com/http/1.6/sendSMS.do', null, {
      params: {
        accessToken: process.env.SMSMODE_API_TOKEN,
        message,
        numero: to,
        emetteur: 'Gebeta' // Optional sender name
      }
    });

    if (response.data.includes('OK')) {
      console.log('✅ SMS sent');
    } else {
      console.error('❌ SMS Error:', response.data);
    }
  } catch (err) {
    console.error('❌ SMS Exception:', err.message);
  }
};
