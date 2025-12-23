const testShipping = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/shipping/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerZip: '1001',
        items: [
          {
            id: '1',
            quantity: 1,
            price: 1000
          }
        ],
        subtotal: 1000
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
};

testShipping();
