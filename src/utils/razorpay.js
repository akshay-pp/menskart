import Razorpay from 'razorpay'
import { validatePaymentVerification } from '../../node_modules/razorpay/dist/utils/razorpay-utils.js'

export const razorpay = new Razorpay({

    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET

})

export const verifySign = (orderId, paymentId, signature, secret) => {

    try {

        const isValid = validatePaymentVerification (
            { "order_id": orderId, "payment_id": paymentId},
            signature,
            secret
        );

        if (isValid) {

            return {success: true, isValid};
        }

    } catch (error) {

        return {success: false, error};
        
    }
}


