# Shopify setup for StoreForge

StoreForge connects to a Shopify store through OAuth. It never asks you to paste an Admin API access token into the browser.

## Owner-mode setup

1. Create a Shopify app in the Shopify developer/partner dashboard.
2. Set the app URL to your StoreForge URL. For local use this is normally `http://localhost:3000`.
3. Add the allowed redirection URL:
   `http://localhost:3000/api/shopify/oauth/callback`
4. Put the app API key and secret in `.env.local`.
5. Keep the scope list from `.env.example`, then install/connect the app from StoreForge Settings.

StoreForge currently asks for product, file, publication, theme, and navigation access because the build workflow creates products, uploads media, can publish the product to Online Store when the owner enables that setting, reads/duplicates themes, and prepares for store-navigation automation. Product publication is off by default.

## Theme permissions

StoreForge writes only to duplicated/unpublished themes. The selected master and the live theme are not edited.

For a public SaaS app, Shopify can require additional approval/exemption for apps that modify theme code. Treat this as a launch requirement before opening StoreForge to outside merchants.

## Master theme

Use Settings → Master Theme to upload your licensed Shrine ZIP once per destination store. The browser sends the ZIP directly to Shopify's staged-upload target, then StoreForge installs it as an unpublished master theme. Every product build duplicates that master first.
