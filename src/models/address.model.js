import { Schema, model } from "mongoose";


const addressSchema = new Schema({
    
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    phone: {
        type: String,
        required: true
    },

    pincode: {
        type: Number,
        required: true,
        trim: true
    },

    address: {
        type: String,
        trim: true
    },

    city: {
        type: String,
        required: true,
        trim: true
    },

    state: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        required: true,
        trim: true
    }
})


export const Address = model("Address", addressSchema);