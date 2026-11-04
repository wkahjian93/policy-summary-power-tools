# Policy Summary Power Tools: how to use it

**The pain:** a policy summary means gathering every policy from every insurer, working out what each one covers and adding it all up by hand. That takes hours.
**The fix:** snap or key in each policy, confirm anything the app wasn't sure about, and send the client a polished PDF in minutes.

## What you need

| Item | Format | Status |
|---|---|---|
| Team server | The REDEFINE Form Filler Google server (already live) | Connected, nothing to set up |
| Team code | The same code you use in Form Filler | Type it into the app on your phone only. Never paste it into chat. |
| Client documents | Photos or screenshots: policy schedule, contract page, annual statement, benefit illustration, or the insurer's app/portal screen. JPG/PNG/HEIC from the camera or gallery. | Bring them to the meeting |
| Your name, title and phone | Typed into Settings | Shown at the bottom of every PDF |

## Using it (about 5 minutes per client)

1. **Open the app** and tap **+ New client summary**. Enter the name as it should appear on the PDF. Age and annual income are optional; adding income turns on the "compared with a guideline" bars.
2. **Add policies.** Use either button:
   - **Snap / upload policy photos.** Take a photo or pick screenshots, up to 4 at a time. Pages of one policy can go together, and a portal screen listing several policies is fine. Tap **Read with AI**, which usually takes 20–60 seconds. The first time, sign in with your name and the team code.
   - **Key in a policy.** Type it in yourself. This works offline with no AI.
3. **Confirm the orange items.** Anything the AI couldn't read clearly (a blurred amount, an unknown insurer, a benefit it couldn't place) turns orange. Fix it, or tap **Looks right**. **Missing amounts are never treated as RM0.** They show as "Not stated" until you fill them in.
4. **See summary & PDF.** You get three views: *At a glance* (the "wow" page), *Side by side* (every policy against every category) and *Details* (every rider).
5. **Create PDF**, then **Send to client…** The app asks you to confirm the client's name, then opens WhatsApp, email or another app. **Save / open PDF** keeps a copy.

## What the summary adds up

- **Death, TPD, Critical Illness, Early CI, Accident, Hospital income:** added up across all in-force policies. A "Death / TPD" benefit that pays once is shown under both, labelled "paid once".
- **Medical card:** shows the **highest** annual limit, the lifetime limit and room & board. Medical cards don't simply add up, and the PDF says so.
- **Cash value and bonus:** added up from the figures on the documents, with their dates.
- **"Drops to RM400k at age 65":** the app warns when term cover ends.
- **Lapsed, surrendered and matured policies** are listed in grey and not counted.

## Insurer and benefit recognition

The app recognises 24 Malaysian life and takaful insurers by full legal name, short form (PAMB, HLA, GELM…) or Chinese name. Benefit names are read in English, Malay or Chinese ("Penyakit Kritikal", "危疾", "Kad Perubatan"…). **When you change a benefit's category, the app remembers it.** The next photo with that benefit name is read your way.

## Privacy and safety

- Client details stay **on your phone only**. Photos are sent to the AI once, read and discarded (OpenAI `store:false`). Nothing is saved on the server.
- Policy numbers are cut to the last 4 digits. IC numbers are never kept.
- Before deleting a client or policy, and before sending, the app asks you to confirm.
- The PDF can't be created while any item still needs confirming.
- Every PDF has a disclaimer: it's a discussion summary from the client's documents, not a policy contract, quotation or recommendation.

## For maintenance

- `docs/` is the app. `logic.js` handles recognition and calculations, `report.js` builds the PDF pages, `app.js` runs the screens, and `config.js` holds the server address.
- `node test.js` runs 65 checks covering recognition, messy numbers, the never-guess rules and the summary maths.
- `node serve.js` previews the app at http://localhost:5193.
- `samples/` holds the sample PDF made by the app.
- The server is `REDEFINE Form Filler/server/Code.gs`. Both apps share its daily AI limit (`DAILY_LIMIT`).
