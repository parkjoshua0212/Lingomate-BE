import prisma from '../lib/prisma.js';

export default () => {
    const controller = {};

    // 1.1 Me
    controller.getMe = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub },
                include: { subscription: true }
            });
            
            if (!user) return res.status(404).json({ success: false, message: "Not registered" });

            res.json({
                success: true,
                data: {
                    auth0Id: auth0Sub,
                    userId: user.id,
                    email: user.email,
                    name: user.username,
                    subscription: user.subscription?.planName || 'free'
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "Server Error" });
        }
    };

    return controller;
};