import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Study database unavailable');return env.DB;}
