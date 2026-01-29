import {Schema, model} from "mongoose";

const walletHistorySchema = new Schema({

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
        type: Schema.Types.ObjectId,
        ref: "Order"
    },

    refundType: {
        type: String,
        enum: ["return", "cancel"]
    },

    referee: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }

}, {timestamps: true})

const walletSchema = new Schema({

    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    balance: {
        type: Number,
        default: 0,
        required: true
    },

    history: [walletHistorySchema]


})


export const Wallet = model("Wallet", walletSchema);