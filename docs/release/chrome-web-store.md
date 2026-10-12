# Publishing Lophorina on the Chrome Web Store

Release: **0.1.0**, **Unlisted** (only people with the link can install it). Switch to Public after the 30-minute false-activation test (Week 5, M2) and pilot feedback.

## 1. Build the package

```bash
npm run package        # → release/lophorina-0.1.0.zip (store build: no Diagnostics, no recorder)
```

## 2. Publish the privacy page (once)

1. GitHub → repository **Lophorina** → Settings → General → Danger Zone → **Change visibility → Public**.
2. Settings → **Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/docs` → Save.
3. After a minute, check that this opens: **https://ahmedtawfikgalal.github.io/Lophorina/privacy.html**

## 3. Create the listing

1. Open the Chrome Web Store Developer Dashboard and register a developer account (one-time fee; check the current amount on the registration page).
2. **New item** → upload `release/lophorina-0.1.0.zip`.
3. Fill in the tabs using the texts below, then **Submit for review** with visibility **Unlisted**.

Review usually takes a few days, possibly longer because the extension uses the camera. Field names in the dashboard may differ slightly from the headings below.

## Store listing

**Name:** Lophorina

**Summary** (≤ 132 characters):
> Control YouTube with hand gestures: play, pause and skip. Video is processed on your device and never leaves it.

**Description:**
> Lophorina lets you control YouTube videos without touching your keyboard or mouse: useful while cooking, exercising, studying, or whenever your hands are busy.
>
> How it works
> 1. Open a YouTube video and click the Lophorina icon to open its side panel.
> 2. Press Start Control.
> 3. Hold a pose still for about a second:
>    • Open palm: Play / Pause
>    • Thumb up: skip forward 10 seconds
>    • Thumb down: go back 10 seconds
>
> Private by design
> • The camera turns on only when you press Start Control and turns off when you stop or close the panel.
> • Hand gestures are recognized on your device. Video is never recorded, stored, or sent anywhere.
> • No accounts, analytics, or ads.
> • Works only on youtube.com.
>
> Also includes on-screen Play/Pause and ±10 s buttons, a hand-position guide, a keyboard shortcut (Alt+Shift+G), and settings to turn individual gestures off or change how long to hold them.

**Category:** Accessibility (alternative: Tools) · **Language:** English

**Graphics:**
- Icon 128×128: `public/icons/icon-128.png`
- Screenshot 1280×800: `docs/release/screenshot-1280x800.png`

## Privacy practices

**Single purpose:**
> Control YouTube video playback (play, pause, skip) with hand gestures recognized on the user's device.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's gesture settings (which gestures are enabled, hold time) locally on the device. |
| `sidePanel` | The controls and camera preview are shown in the side panel next to the YouTube video, so they stay visible while the video plays. |
| Host `https://www.youtube.com/*` | Needed to play, pause, and skip the video on YouTube watch pages when the user makes a gesture or presses a button. No other site is accessed. |

The camera is not a manifest permission. It is requested with Chrome's standard camera prompt when the user first starts control.

**Remote code:** No. All code, including the gesture model, is in the package.

**Data usage:** the extension does not collect or transmit any user data. Camera frames are processed locally and discarded; the YouTube tab title is only displayed locally. Certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending.

**Privacy policy URL:** https://ahmedtawfikgalal.github.io/Lophorina/privacy.html

## 4. Test on the second laptop

Once approved, open the listing link on the second laptop, click **Add to Chrome**, and check:

1. Click the Lophorina icon → the side panel opens with "How to use".
2. Start Control → the panel asks you to allow the camera in a tab → allow it → come back → Start Control.
3. Open a YouTube video → the panel says "Controlling: …".
4. Palm, thumb up, thumb down each do the right thing; the three buttons work.
5. Stop Control → camera light off.

Report what happened, plus the laptop model and webcam, and anything confusing on first use.
