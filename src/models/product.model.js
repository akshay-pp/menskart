import {Schema, model} from "mongoose";

const productSchema = new Schema(
    {
        productname: {
            type: String,
            required: [true, "product name is required"],
            trim: true
        },
        
        description: {
            type: String,
            trim: true
        },

        price: {
            type: Number,
            required: true
        },

        discountedPrice: {
            type: Number
        },

        activeOffer: {
            offerId: {
                type: Schema.Types.ObjectId,
                ref: "Offer"
            },
            isPercent: {
                type: Boolean
            },
            amount: {
                type: Number
            }
        },

        brand: {
            type: Schema.Types.ObjectId,
            ref: "Brand",
            default: null,

        },

        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },

        subcategory: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },

        images: {
            type: [String],
            required: true
        },

        stock: {
            type: Number,
            required: true
        },

        maxQuantity: {
            type: Number,
            required: true,
            default: 10
        },

        returnPeriod: {
            type: Number,
            required: true,
            default: 14
        },

        reviews: {
            type: Schema.Types.ObjectId,
            ref: "Review",
            default: null
        },

        isUnListed: {
            type: Boolean,
            default: false
        }

    },

    {timestamps: true}
)



export const Product = model("Product", productSchema);