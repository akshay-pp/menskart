import {Schema, model} from "mongoose";

const brandSchema = new Schema(
    
    {
        name: {
            type: String,
            required: [true, "Brandname is required"],
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
        }

    },

    {timestamps: true}
)

export const Category = model("Category", categorySchema);