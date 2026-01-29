import {Schema, model} from "mongoose";


const cartItemSchema = new Schema({

    product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    
    price: {
        type: Number,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        default : 1
    }
})




const cartSchema = new Schema({

    owner : {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    items : [cartItemSchema],


    totalPrice: {
        type: Number,
        required: true,
        default: 0 
    },


}, {timestamps: true})


cartSchema.pre("save", function(next) {
    this.totalPrice = this.items.reduce((total,item) => total + (item.price * item.quantity),0);
    next()
})


export const Cart = model("Cart", cartSchema);