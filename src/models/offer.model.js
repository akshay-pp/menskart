import {Schema, model} from "mongoose";

const offerSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        enum: ['category', 'product', 'referal']
    },

    appliesTo: [
        {
            _id: false,
            categName: {
                type: String
            },
            categId: {
                type: Schema.Types.ObjectId,
                ref: "Category"
            }
        }
    ],

    productIds: {
        type: Schema.Types.ObjectId,
        ref: 'Product'
    },

    isActive: {
        type: Boolean,
        required: true,
        default: true
    },

    isPercent: {
        type: Boolean,
        required: true
    },

    offerAmount: {
        type: Number,
        required: true
    },

    description: {
        type: String,
        trim: true
    },

    minimumValue: {
        type: Number,
        required: true,
        default: 199
    },

    maxDiscount: {
        type: Number,
        required: function(){return this.isPercent},
        default: 499
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


export const Offer = model("Offer", offerSchema);