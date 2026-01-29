import {Schema, model} from "mongoose";

const wishlistSchema = new Schema({

    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    products: [
        {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        }
    ]

}, {timestamps: true});


export const Wishlist = model("Wishlist", wishlistSchema);