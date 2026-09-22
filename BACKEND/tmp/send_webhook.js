const axios = require('axios');
const crypto = require('crypto');

(async () => {
  try {
    const url = 'http://localhost:5000/api/payments/webhook';
    const secret = 'test_webhook_secret';
    const payload = {
      data: {
        event: 'charge.success',
        data: {
          reference: 'ESNEX-ASSESSMENT-145F830DD0A4',
          transaction_id: 'ESNEX-ASSESSMENT-145F830DD0A4',
          amount: 202,
          currency: 'GMD'
        }
      }
    };

    const bodyString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const res = await axios.post(url, bodyString, {
      headers: {
        'Content-Type': 'application/json',
        'x-wave-signature': hmac
      },
      timeout: 10000
    });

    console.log('Webhook response status:', res.status);
    console.log('Webhook response data:', res.data);
  } catch (err) {
    if (err.response) {
      console.error('Error response status:', err.response.status);
      console.error('Error response data:', err.response.data);
      process.exit(1);
    }
    console.error('Request failed:', err.message);
    process.exit(2);
  }
})();