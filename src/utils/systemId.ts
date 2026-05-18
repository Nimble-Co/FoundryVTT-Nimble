import systemJson from '../../public/system.json';

// typed as any to make all the setFlag/getFlag etc calls happy
export const SYSTEM_ID: any = systemJson.id;
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;
