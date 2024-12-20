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