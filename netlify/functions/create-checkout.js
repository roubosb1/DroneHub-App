const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, jobName, invoiceNumber, clientEmail, currency, jobId } = JSON.parse(event.body);

    // amount comes in as dollars (e.g. 347.52), convert to cents
    const amountCents = Math.round(parseFloat(amount) * 100);

    if (!amountCents || amountCents < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (currency || 'cad').toLowerCase(), // CAD default; pass 'usd' for US invoices
          product_data: {
            name: jobName || 'DroneHub Media Invoice',
            description: invoiceNumber ? 'Invoice ' + invoiceNumber : '',
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: clientEmail || undefined,
      success_url: `https://sparkly-halva-0d1aa9.netlify.app/?payment=success&jobId=${jobId||''}`,
      cancel_url: 'https://sparkly-halva-0d1aa9.netlify.app/?payment=cancelled',
      metadata: {
        invoice_number: invoiceNumber || '',
        job_id: String(jobId || ''),
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
