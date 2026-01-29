import { Schema, model } from "mongoose";

const couponSchema = new Schema({

    name : {
        type: String,
        min: 6,
        max: 15, 
        required: true,
        trim: true,
    },

    code : {
        type: String,
        min: 6,
        max: 15, 
        required: true,
        trim: true,
    },

    description: {
        type: String,
        trim: true
    },

    isPercent: {
        type: Boolean,
        required: true
    },

    maxDiscount: {
        type: Number,
        required: function(){return this.isPercent},
        default: 499
    },

    couponAmount: {
        type: Number,
        required: true
    },

    couponActive: {
        type: Boolean,
        default: true,
    },

    minimumCartValue: {
        type: Number,
        required: true,
        default: 499
    },

    maxUsage: {
        type: Number,
        required: true,
        default: 500
    },

    usage: {
        type: Number,
        required: true,
        default: 0
    },

    validFrom: {
        type: Date,
        required: true
    },

    expiry: {
        type: Date,
        required: true
    }


}, {timestamps: true});



export const Coupon = model("Coupon", couponSchema);