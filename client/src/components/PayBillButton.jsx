// ================== PayBillButton ==================
// A self-contained "Pay Now" button that loads the Razorpay Checkout
// script on demand, creates an order on the backend, opens the Razorpay
// payment popup, and verifies the payment server-side once it succeeds.
//
// Usage:
//   <PayBillButton
//     billId={bill.id}
//     amount={bill.amount}
//     patientName={user?.name}
//     patientEmail={user?.email}
//     onPaid={() => reloadBills()}
//   />

import { useState } from 'react'
import { toast } from 'react-toastify'
import api from '../utils/api'

// Loads the Razorpay Checkout script once and caches the promise so
// repeated clicks don't re-inject the <script> tag.
let razorpayScriptPromise = null
function loadRazorpayScript() {
  if (razorpayScriptPromise) return razorpayScriptPromise
  razorpayScriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'))
    document.body.appendChild(script)
  })
  return razorpayScriptPromise
}

export default function PayBillButton({ billId, amount, patientName, patientEmail, patientContact, onPaid, className = '' }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      await loadRazorpayScript()

      // 1. Ask our backend to create a Razorpay order for this bill
      const { data: order } = await api.post(`/billing/${billId}/create-order`)

      // 2. Open Razorpay's checkout popup
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'SwasthAashra',
        description: `Hospital bill #${billId}`,
        prefill: {
          name: patientName || '',
          email: patientEmail || '',
          contact: patientContact || '',
        },
        theme: { color: '#5A6BEB' },
        handler: async (response) => {
          // 3. Verify the payment on the backend before trusting it
          try {
            await api.post(`/billing/${billId}/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            toast.success('Payment successful! Bill marked as paid.')
            onPaid?.()
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Payment verification failed')
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      })

      rzp.on('payment.failed', (response) => {
        toast.error(response?.error?.description || 'Payment failed')
        setLoading(false)
      })

      rzp.open()
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not start payment')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className={`px-4 py-2 rounded-full text-sm font-semibold text-white bg-brand-gradient disabled:opacity-60 ${className}`}
    >
      {loading ? 'Opening…' : `Pay ₹${amount}`}
    </button>
  )
}
