let _db = null;
function getDb() {
  if (!_db) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    _db = admin.firestore();
  }
  return _db;
}

const PLAID_BASE = process.env.PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : 'https://sandbox.plaid.com';

async function plaidPost(endpoint, body) {
  const resp = await fetch(`${PLAID_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_message || JSON.stringify(data));
  return data;
}

const CAT_MAP = {
  'FOOD_AND_DRINK': 'Meals & Entertainment',
  'TRANSPORTATION': 'Fuel/EV',
  'TRAVEL': 'Travel',
  'RENT_AND_UTILITIES': 'Rent',
  'GENERAL_SERVICES': 'Miscellaneous',
  'GENERAL_MERCHANDISE': 'Supplies',
  'ENTERTAINMENT': 'Meals & Entertainment',
  'PERSONAL_CARE': 'Personal',
  'MEDICAL': 'Personal',
  'GOVERNMENT_AND_NON_PROFIT': 'Miscellaneous',
  'BANK_FEES': 'Bank Fee',
  'TRANSFER_IN': 'Account Transfer',
  'TRANSFER_OUT': 'Account Transfer',
  'LOAN_PAYMENTS': 'CC Payment',
  'INCOME': 'Invoice Payment',
};

function mapCategory(plaidCat) {
  if (!plaidCat) return 'Miscellaneous';
  return CAT_MAP[plaidCat] || 'Miscellaneous';
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };

  const auth = event.headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  try {
    const db = getDb();
    const docId = body.orgId + ':plaid_items';
    const doc = await db.collection('dh_secure').doc(docId).get();
    if (!doc.exists) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ transactions: [], accounts: [] }) };
    }

    const items = doc.data().items || [];
    const targetItem = body.itemId
      ? items.find(i => i.item_id === body.itemId)
      : items[0];

    if (!targetItem) {
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Item not found' }) };
    }

    const now = new Date();
    const startDate = body.startDate || new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const endDate = body.endDate || now.toISOString().slice(0, 10);

    const txData = await plaidPost('/transactions/get', {
      access_token: targetItem.access_token,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset: 0 },
    });

    const transactions = txData.transactions.map(tx => ({
      plaid_id: tx.transaction_id,
      date: tx.date,
      vendor: tx.merchant_name || tx.name || 'Unknown',
      amount: tx.amount,
      cat: mapCategory(tx.personal_finance_category?.primary),
      plaid_cat: tx.personal_finance_category?.primary || '',
      plaid_detail: tx.personal_finance_category?.detailed || '',
      account_id: tx.account_id,
      pending: tx.pending,
      country: targetItem.country,
    }));

    const accounts = txData.accounts.map(a => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
      balance: a.balances?.current,
      currency: a.balances?.iso_currency_code,
    }));

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ transactions, accounts, total: txData.total_transactions }),
    };
  } catch (err) {
    console.error('plaid-sync error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
