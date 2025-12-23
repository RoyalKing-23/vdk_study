import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import ServerConfig from "@/models/ServerConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    const config = await ServerConfig.findOne({ _id: 1 }).lean() as any;

    if (!config) {
      console.warn("[serverInfo] Server config not found, using defaults");
      // Return defaults if config is missing in DB
      return res.status(200).json({
        webName: "VDK Study",
        sidebarLogoUrl: "https://i.ibb.co/3Wqj2jV/logo.png",
        sidebarTitle: "VDK Study",
        tg_channel: "https://t.me/VaradKw",
        tg_username: "VaradKw",
        isDirectLoginOpen: true,
        tg_bot: "VaradBot"
      });
    }

    const { sidebarLogoUrl, sidebarTitle, tg_channel, tg_username, isDirectLoginOpen, webName, tg_bot } = config;
    return res.status(200).json({
      webName,
      sidebarLogoUrl,
      sidebarTitle,
      tg_channel,
      tg_username,
      isDirectLoginOpen,
      tg_bot
    });
  } catch (error) {
    console.error("[serverInfo] Error:", error);
    // Return defaults on error to prevent client crash
    return res.status(200).json({
      webName: "VDK Study",
      sidebarLogoUrl: "https://i.ibb.co/3Wqj2jV/logo.png",
      sidebarTitle: "VDK Study",
      tg_channel: "https://t.me/VaradKw",
      tg_username: "VaradKw",
      isDirectLoginOpen: true,
      tg_bot: "VaradBot"
    });
  }
}
