import express from "express";
import { getMyWallet, getTransactions, deposit, withdraw, transfer } from "../controllers/walletController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/me", getMyWallet);
router.get("/transactions", getTransactions);
router.post("/deposit", deposit);
router.post("/withdraw", withdraw);
router.post("/transfer", transfer);

export default router;
