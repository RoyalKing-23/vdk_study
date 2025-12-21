import dbConnect from "@/lib/mongodb";
import ServerConfig, { IServerConfig } from "@/models/ServerConfig";

export async function getServerConfig() {
    try {
        await dbConnect();
        const config = await ServerConfig.findOne({ _id: 1 }).lean();

        if (!config) {
            return null;
        }

        // We only need specific fields as per the original API
        // However, since we are calling this internally, we can return what we need.
        // The original API returned:
        // {
        //   webName,
        //   sidebarLogoUrl,
        //   sidebarTitle,
        //   tg_channel,
        //   tg_username,
        //   isDirectLoginOpen,
        //   tg_bot
        // }

        // Casting to any to access properties safely or use interface if compatible
        const c = config as unknown as IServerConfig;

        return {
            webName: c.webName,
            sidebarLogoUrl: c.sidebarLogoUrl,
            sidebarTitle: c.sidebarTitle,
            tg_channel: c.tg_channel,
            tg_username: c.tg_username,
            isDirectLoginOpen: c.isDirectLoginOpen,
            tg_bot: c.tg_bot,
        };
    } catch (error) {
        console.error("Error getting server config:", error);
        return null;
    }
}
