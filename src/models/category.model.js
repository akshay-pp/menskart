import {Schema, model} from "mongoose";

const categorySchema = new Schema(
    
    {
        name: {
            type: String,
            required: [true, "name is required"],
            trim: true
        },
        
        description: {
            type: String,
            trim: true
        },

        parent: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },

        isUnListed: {
            type: Boolean,
            default: false
        }

    },

    {timestamps: true}
)

export const Category = model("Category", categorySchema);