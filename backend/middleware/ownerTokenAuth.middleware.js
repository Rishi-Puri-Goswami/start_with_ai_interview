import Owner from "../model/owner.model.js";
import jwt from 'jsonwebtoken';

export const ownerTokenAuth = async (req, res, next) => {
    try {
        const otoken = req.cookies?.otoken;

        // console.log(req.cookies)
        // console.log('cookies:', req.cookies)
        if (!otoken) {
            return res.status(401).json({ message: "No owner token provided" });
        }

        const secret = process.env.JWT_SERECT_KEY;

        let decoded;
        try {
            decoded = jwt.verify(otoken, secret);
        } catch (err) {
            return res.status(401).json({ message: "Invalid owner token" });
        }

        const userId = decoded.id;
        const user = await Owner.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Owner not found" });
        }

        req.user = user._id;
        return next();
    } catch (error) {
        console.error('ownerTokenAuth error:', error);
        return res.status(500).json({ message: 'owner token auth middleware error', error });
    }
}