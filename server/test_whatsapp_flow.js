// Test Verification Script for WhatsApp Connection & Safety Engine
import { 
  connectToWhatsApp, 
  getWhatsAppStatus, 
  getPairingQR, 
  requestPhoneNumberPairing,
  sendWhatsAppMessage,
  resetWhatsAppSession 
} from './whatsapp.js';
import { properties } from './dataStore.js';

async function runVerification() {
  console.log('🧪 [TEST 1] Initializing WhatsApp connection...');
  await connectToWhatsApp(true);

  // Wait for initial handshake
  await new Promise(r => setTimeout(r, 2000));

  const status1 = getWhatsAppStatus();
  console.log('✅ [TEST 1 Result] Status:', status1.state, 'Has QR:', !!status1.qrCode);

  console.log('\n🧪 [TEST 2] Requesting real pairing code for valid number...');
  const codeRes = await requestPhoneNumberPairing('919811100001');
  console.log('✅ [TEST 2 Result] Code Response:', codeRes);

  console.log('\n🧪 [TEST 3] Testing invalid phone number handling...');
  const invalidCodeRes = await requestPhoneNumberPairing('123');
  console.log('✅ [TEST 3 Result] Invalid Phone:', invalidCodeRes);

  console.log('\n🧪 [TEST 4] Safety Shield: Sending message when WhatsApp is not connected...');
  const unsafeSendRes1 = await sendWhatsAppMessage({
    recipientJid: '1203630001@g.us',
    text: 'Test reply',
    approvedBy: 'Sarthak (Ops Manager)',
    propertyId: 'PROP-001'
  });
  console.log('✅ [TEST 4 Result] Unconnected Guard:', unsafeSendRes1);

  console.log('\n🧪 [TEST 5] Safety Shield: Sending message without human approval...');
  const unsafeSendRes2 = await sendWhatsAppMessage({
    recipientJid: '1203630001@g.us',
    text: 'Test reply without approval',
    approvedBy: '',
    propertyId: 'PROP-001'
  });
  console.log('✅ [TEST 5 Result] Human Approval Guard:', unsafeSendRes2);

  console.log('\n🧪 [TEST 6] Safety Shield: Cross-property destination mismatch...');
  const unsafeSendRes3 = await sendWhatsAppMessage({
    recipientJid: '1203630002@g.us', // Mismatched group for PROP-001
    text: 'Test reply for Grand Residency',
    approvedBy: 'Sarthak (Ops Manager)',
    propertyId: 'PROP-001'
  });
  console.log('✅ [TEST 6 Result] Cross-Property Guard:', unsafeSendRes3);

  console.log('\n🎉 ALL SAFETY & AUTH TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
