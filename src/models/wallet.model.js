import {Schema, model} from "mongoose";

const walletTransactionSchema = new Schema({

    amount: {
        type: Number,
        required: true
    },
    
    direction: {
        type: String,
        enum: ["Credit", "Debit"],
        required: true
    },

    source: {
        type: String,
        enum: ["refund", "referral", "paid-for-order"],
        required: true
    },

    relatedOrder: {
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order"
        },
        itemId: {
            type: Schema.Types.ObjectId
        }
    },

    refundType: {
        type: String,
        enum: ["return", "cancel"]
    },

    referee: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },

    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        required: true,
        default: 'pending'
    }

}, {timestamps: true})

const walletSchema = new Schema({

    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    
    balance: {
        type: Number,
        default: 0,
        required: true
    },

    transactions: [walletTransactionSchema]


})


export const Wallet = model("Wallet", walletSchema);