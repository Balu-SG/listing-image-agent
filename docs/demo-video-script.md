# Demo video script (2:34)

Live site: https://d2dvlco30s0p5j.cloudfront.net · Code: https://github.com/Balu-SG/listing-image-agent

Voiceover: Indian English, Amazon Polly voice Arjun (generative engine), one clip per scene in
`out/voiceover/arjun/scene01.mp3` … `scene09.mp3`; full track timed to the scenes below: `out/voiceover/voiceover_arjun_timed.mp3`.
Timings below are each clip's length plus room for the visuals.
Record the screen at 1440 × 900 in light mode. Warm the site up first (open it once a minute before
recording) so nothing waits on a cold start. Numbers below are from real runs on the live site.

| # | Time | On screen | Voiceover |
| --- | --- | --- | --- |
| 1 | 0:00–0:12 | Amazon search results grid; zoom on a product with a grey backdrop and a "BEST SELLER" badge. | Every Amazon listing lives or dies by its main image. If it breaks the image rules, the listing can be pulled from search. Sellers usually find out after the sales are lost. |
| 2 | 0:12–0:25 | Live site home page: headline "Compliant listing images, product untouched." Slowly scroll past the four steps. | This is the Listing Image Compliance Agent. It checks a photo against Amazon's rules, fixes what it safely can, and proves that the product itself was never changed. |
| 3 | 0:25–0:46 | Click the demo phone-case example. Score ring shows 70. Open the "Issues" tab; hover the R4 info icon so the tooltip quoting Amazon appears. | OpenCV 5 inspects eight rules taken from Amazon's own Seller Central page. This photo scores 70. The background is off-white, there's a border, a "Best seller" badge, which Amazon names as not allowed, and the product fills only fifty-four percent of the frame. |
| 4 | 0:46–1:14 | Click "Fix with agent". The timeline fills step by step: remove border, remove text or badge, whiten background, reframe to fill. Score rises 73 → 83 → 93 → 100. | Now the agent. Claude Opus 4.6 on Amazon Bedrock reads the inspection report, not the image, and decides which tools to run, and in what order. Every edit is a deterministic OpenCV operation. After each step, the system checks every product pixel. If even one pixel of the product changes, the edit is rejected. |
| 5 | 1:14–1:33 | Before/after slider, dragged slowly. Then the "Product unchanged" card: "0 product pixels changed", 616,621 compared, difference map. Click "Download fixed image". | From seventy to a hundred, in four steps. And here is the proof: over six hundred thousand product pixels compared, zero changed. Only the backdrop and the framing moved. The seller downloads a compliant image. |
| 6 | 1:33–1:50 | Open the wallet example (scene photo). "Needs a new photo" panel; agent summary saying it cannot convert a lifestyle photo by editing. | Just as important: knowing when not to edit. This is a lifestyle photo. Guessing what to erase could damage the product, so the agent makes no edits and tells the seller exactly what to reshoot. |
| 7 | 1:50–2:02 | Search visibility card: search grid of nine thumbnails, then the saliency heat map with the product's tile outlined. | The agent also shows how the image performs as a search thumbnail, using OpenCV saliency to see where a shopper's eye goes. |
| 8 | 2:02–2:24 | Architecture: README diagram or a slide listing the AWS services; quick cut to the evaluation table. | Under the hood: OpenCV 5 for segmentation, text detection, inpainting and saliency. AWS Lambda, Amazon Bedrock, S3, DynamoDB, API Gateway and CloudFront. On a held-out test set, the fill check scores ninety-three percent precision and recall. |
| 9 | 2:24–2:34 | Home page with the URL and GitHub link on screen. | Compliant listing images, with the product untouched. Try it live, and the code is open on GitHub. |

## Recording checklist

- Open the site once a minute before recording (avoids a cold start).
- Use the gallery's demo phone case for scenes 3–5 if a fresh "Fix with agent" run is not needed on camera;
  for a live run, upload `assets/demo/demo_phone_case.jpg` from the repo.
- Keep the mouse still while the voiceover explains; move it only to point.
- Add captions (judges often watch muted); the voiceover text above is the caption text.
- Export 1080p; total length 2:34.
