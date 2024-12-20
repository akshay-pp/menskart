import fs from 'fs';
import path from 'path';
import multer from "multer";
import sharp from "sharp";


const uploadDir = path.resolve('./uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./uploads")
    },
    filename: function (req, file, cb) {
      const extname = path.extname(file.originalname);
      const filename = `${Date.now()}${extname}`;
      cb(null, filename)
    }
});

export const upload = multer({ storage });