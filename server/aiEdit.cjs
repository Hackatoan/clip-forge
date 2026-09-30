// AI-assisted editing: turns a plain-English request into a sequence of
// calls against the editor's own existing primitives (trim/split/filters/
// transitions/etc — see src/store/editorStore.js), instead of the model
// generating raw video/pixel output. The client applies the returned actions
// through the same store functions manual editing uses, so undo/redo and
// every existing invariant just work for free.
//
// Preset enums (FILTER_PRESETS/GRADE_PRESETS names) mirror
// src/engine/presets.js exactly -- keep both in sync if either changes.

const FILTER_PRESET_NAMES = ['None', 'B&W', 'Vintage', 'Warm', 'Cool', 'Vivid'];
const GRADE_PRESET_NAMES = ['None', 'Teal & Orange', 'Cinematic', 'Warm film', 'Cold', 'Moody'];
const TRANSITION_TYPES = ['none', 'fade', 'fade-black', 'fade-white', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'];

// gemini-flash-lite-latest: matches the quota-safe model this account
// already standardizes on elsewhere (see music-organizer/i18n notes) and,
// unlike gemini-flash-latest, didn't 503 under load during testing.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

const TOOLS = [{
    functionDeclarations: [
        {
            name: 'trim_clip',
            description: "Change a clip's start time and/or duration on the timeline.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    clip_id: { type: 'STRING' },
                    start: { type: 'NUMBER', description: 'New absolute timeline start time, in seconds' },
                    duration: { type: 'NUMBER', description: 'New duration, in seconds' },
                },
                required: ['clip_id'],
            },
        },
        {
            name: 'split_clip',
            description: 'Split one clip into two separate clips at a given point in time.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    clip_id: { type: 'STRING' },
                    at_time: { type: 'NUMBER', description: 'Absolute timeline time, in seconds, to cut at' },
                },
                required: ['clip_id', 'at_time'],
            },
        },
        {
            name: 'delete_clip',
            description: 'Remove a clip from the timeline entirely.',
            parameters: { type: 'OBJECT', properties: { clip_id: { type: 'STRING' } }, required: ['clip_id'] },
        },
        {
            name: 'duplicate_clip',
            description: 'Duplicate a clip, placing the copy immediately after the original on the same track.',
            parameters: { type: 'OBJECT', properties: { clip_id: { type: 'STRING' } }, required: ['clip_id'] },
        },
        {
            name: 'set_speed',
            description: 'Change a clip\'s playback speed. 1 is normal speed, 2 is double speed, 0.5 is half speed.',
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, speed: { type: 'NUMBER' } },
                required: ['clip_id', 'speed'],
            },
        },
        {
            name: 'apply_filter_preset',
            description: 'Apply one of the built-in visual filter presets to a clip.',
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, preset: { type: 'STRING', enum: FILTER_PRESET_NAMES } },
                required: ['clip_id', 'preset'],
            },
        },
        {
            name: 'apply_color_grade',
            description: 'Apply one of the built-in cinematic color-grade presets to a clip.',
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, preset: { type: 'STRING', enum: GRADE_PRESET_NAMES } },
                required: ['clip_id', 'preset'],
            },
        },
        {
            name: 'set_transition',
            description: "Set a transition on a clip's incoming or outgoing edge.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    clip_id: { type: 'STRING' },
                    edge: { type: 'STRING', enum: ['in', 'out'] },
                    type: { type: 'STRING', enum: TRANSITION_TYPES },
                    duration: { type: 'NUMBER', description: 'Transition length in seconds, typically 0.3-1.0' },
                },
                required: ['clip_id', 'edge', 'type'],
            },
        },
        {
            name: 'crossfade_with_previous',
            description: 'Cross-dissolve this clip in over the tail of the previous clip on the same track.',
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, duration: { type: 'NUMBER', description: 'Overlap length in seconds' } },
                required: ['clip_id'],
            },
        },
        {
            name: 'ken_burns',
            description: 'Apply a Ken Burns pan-and-zoom effect to an image or video clip.',
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, mode: { type: 'STRING', enum: ['in', 'out'], description: '"in" zooms in over the clip, "out" zooms out' } },
                required: ['clip_id'],
            },
        },
        {
            name: 'set_volume',
            description: "Set a clip's audio volume. 1 is 100%, 0 is muted, 2 is double.",
            parameters: {
                type: 'OBJECT',
                properties: { clip_id: { type: 'STRING' }, volume: { type: 'NUMBER' } },
                required: ['clip_id', 'volume'],
            },
        },
        {
            name: 'add_marker',
            description: 'Add a timeline marker at a given time, e.g. to flag a beat to revisit.',
            parameters: { type: 'OBJECT', properties: { time: { type: 'NUMBER' } }, required: ['time'] },
        },
    ],
}];

const SYSTEM_PROMPT = `You are an editing assistant inside Clip Forge, a browser-based video editor. \
You make edits by calling the tools provided -- you never invent new clips, and you only ever \
reference a clip_id that appears in the timeline JSON given to you below. All times are in \
seconds and absolute on the timeline (not relative to a clip's own start) unless a tool's own \
description says otherwise. When a request is vague ("make it punchier", "give it a moody \
feel"), make a reasonable, tasteful choice using the available presets rather than asking for \
clarification. Call as many tools as the request actually needs -- a request touching several \
clips should result in several tool calls. After your tool calls, briefly summarize in plain \
English what you did, as if telling the editor what just happened.`;

function buildRequiredArgs(name, args) {
    // Defends against a hallucinated/malformed call reaching the client --
    // the client-side handlers already no-op safely on an unknown clip_id,
    // this just catches missing-required-field cases before they're even sent.
    const requiredByTool = {
        trim_clip: ['clip_id'],
        split_clip: ['clip_id', 'at_time'],
        delete_clip: ['clip_id'],
        duplicate_clip: ['clip_id'],
        set_speed: ['clip_id', 'speed'],
        apply_filter_preset: ['clip_id', 'preset'],
        apply_color_grade: ['clip_id', 'preset'],
        set_transition: ['clip_id', 'edge', 'type'],
        crossfade_with_previous: ['clip_id'],
        ken_burns: ['clip_id'],
        set_volume: ['clip_id', 'volume'],
        add_marker: ['time'],
    };
    const required = requiredByTool[name];
    if (!required) return false;
    return required.every((k) => args[k] !== undefined && args[k] !== null);
}

async function callGeminiForEdit(apiKey, prompt, timeline) {
    const body = {
        system_instruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\nCurrent timeline:\n${JSON.stringify(timeline)}` }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: TOOLS,
    };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Gemini ${r.status}: ${text.slice(0, 500)}`);
    }
    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const actions = [];
    let message = '';
    for (const part of parts) {
        if (part.functionCall && buildRequiredArgs(part.functionCall.name, part.functionCall.args || {})) {
            actions.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
        }
        if (part.text) message += part.text;
    }
    return { actions, message: message.trim() };
}

module.exports = { callGeminiForEdit };
