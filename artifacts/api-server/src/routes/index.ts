import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiMealAssistantRouter from "./ai-meal-assistant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiMealAssistantRouter);

export default router;
