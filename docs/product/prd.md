# Product Requirements Document — MVP

Owner: Product Owner / Tech Lead · Status: Draft for kickoff approval

## Problem

People who cannot or prefer not to touch the keyboard and mouse — while cooking, exercising, presenting, or because of a motor impairment — have no simple, private way to control media in the browser.

## Goal of the first release

A user can intentionally pause, resume, and seek a YouTube video with hand gestures, without accidental commands, and can stop the camera at any time.

The central success question: _can a user perform a hands-free action without repeating the gesture or worrying about an accidental command?_

## Target users

- Hands-busy users (kitchen, workout, studying from video).
- Users with motor impairments who can perform at least one supported gesture. The product must never be the _only_ way to control playback.

## User journey (MVP)

1. User installs the extension and opens Lophorina.
2. First-run onboarding explains: camera is used locally, nothing is uploaded, how to stop.
3. User clicks **Start Control** and grants camera permission.
4. User opens or selects a YouTube watch tab; the extension shows it as the controlled tab.
5. User holds an open palm → video toggles Play/Pause; swipes left/right → seeks −10 s / +10 s.
6. Each recognized command produces textual feedback.
7. User clicks **Stop Control** (or uses the keyboard shortcut) → commands stop immediately, camera is released.

## MVP scope

| In scope                                               | Notes                                          |
| ------------------------------------------------------ | ---------------------------------------------- |
| Explicit Start / Stop Control (button and keyboard)    | Camera never starts without a user action      |
| Hold open palm → `MEDIA_TOGGLE`                        | Hold duration adjustable                       |
| Swipe left / right → `MEDIA_SEEK` −10 / +10 s          | Directions defined from the user's perspective |
| Visible camera and tracking status                     | Text + icon, never color alone                 |
| Command feedback (recognized / executed / failed)      |                                                |
| Per-gesture enable/disable and sensitivity setting     | Stored in `chrome.storage.local`               |
| YouTube watch pages (`https://www.youtube.com/watch*`) | See ADR-004 for excluded page types            |

## Explicitly out of scope for MVP

- Volume, next/previous video, fullscreen, or any other command.
- Custom gestures, gesture editor, "Add Gesture", user-defined mappings beyond enable/disable.
- "Start automatically" — conflicts with explicit activation.
- Google Slides and any site other than YouTube (next release).
- Shorts, embedded players on third-party sites, YouTube Music.
- Backend, accounts, cloud sync, telemetry.
- Dark mode and theming.
- Control of applications outside Chrome (separate future project).

## Success metrics

Release gates are defined in [testing/acceptance-criteria.md](../testing/acceptance-criteria.md). Pilot success: a new user can install, activate, control a video, and stop the extension without developer help.

## Open questions

| #   | Question                                                                         | Resolved by                  |
| --- | -------------------------------------------------------------------------------- | ---------------------------- |
| Q1  | Side Panel or offscreen document for the camera?                                 | Week 1 spike (ADR-001)       |
| Q2  | Is open palm + swipe a usable pair, or does a different static pose work better? | Week 1–3 recorded-data tests |
| Q3  | Target laptop model for performance gates                                        | Tech Lead, before Week 1     |
