const PI_API_BASE = 'https://api.minepi.com';

export async function approvePiPayment(paymentId: string) {
    const PI_API_KEY = process.env.PI_API_KEY;
    if (!PI_API_KEY) throw new Error('PI_API_KEY is not configured');

    const response = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: {
            Authorization: `Key ${PI_API_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pi approval error: ${response.status} - ${error}`);
    }

    return response.json();
}

export async function completePiPayment(paymentId: string, txid: string) {
    const PI_API_KEY = process.env.PI_API_KEY;
    if (!PI_API_KEY) throw new Error('PI_API_KEY is not configured');

    const response = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}/complete`, {
        method: 'POST',
        headers: {
            Authorization: `Key ${PI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txid }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pi completion error: ${response.status} - ${error}`);
    }

    return response.json();
}

export async function getPiPayment(paymentId: string) {
    const PI_API_KEY = process.env.PI_API_KEY;
    if (!PI_API_KEY) throw new Error('PI_API_KEY is not configured');

    const response = await fetch(`${PI_API_BASE}/v2/payments/${paymentId}`, {
        headers: { Authorization: `Key ${PI_API_KEY}` },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pi API error: ${response.status} - ${error}`);
    }

    return response.json();
}
