/**
 * Error-code reference catalog used by /services/error-codes and
 * looked up inline by the service wizard's problem-description step.
 *
 * Ported verbatim from ../../aes-frontend/src/lib/errorCodes.js.
 *
 * Severity values: 'TECH' (Requires Tech) | 'RESET' (Try Reset First)
 * Source: AES_CUSTOMER_PORTAL_IMPLEMENTATION_PROMPT.txt §5.5 Error-codes
 */

export const ERROR_CODE_BRANDS = ['Daikin', 'Carrier', 'Voltas', 'Samsung', 'LG'] as const;

export type ErrorCodeBrand = (typeof ERROR_CODE_BRANDS)[number];

export interface ErrorCodeEntry {
  code: string;
  title: string;
  severity: 'TECH' | 'RESET';
  desc: string;
  tip: string;
}

export const ERROR_CODES: Record<ErrorCodeBrand, ErrorCodeEntry[]> = {
  Daikin: [
    {
      code: 'E1',
      title: 'PCB Defect',
      severity: 'TECH',
      desc: 'Main printed circuit board error. Communication breakdown between indoor and outdoor units.',
      tip: 'Power cycle the unit from the main breaker for 5 minutes. If the code returns immediately, PCB replacement is necessary.',
    },
    {
      code: 'E3',
      title: 'High Pressure',
      severity: 'RESET',
      desc: 'High-pressure switch actuated. Typically caused by poor airflow or an overcharged system.',
      tip: 'Check the outdoor unit for debris (leaves, dirt) blocking the coil. Wash the coil gently with a hose and reset.',
    },
    {
      code: 'E4',
      title: 'Low Pressure',
      severity: 'TECH',
      desc: 'Low pressure detected — typically a refrigerant leak or sensor failure.',
      tip: 'Do not repeatedly reset. Continuous operation with low refrigerant can permanently damage the compressor.',
    },
    {
      code: 'E7',
      title: 'Fan Motor Error',
      severity: 'TECH',
      desc: 'Outdoor DC fan motor anomaly. Motor may be locked or experiencing voltage irregularity.',
      tip: 'Verify if anything is physically obstructing the outdoor fan blades while the power is off.',
    },
    {
      code: 'F3',
      title: 'Discharge Pipe',
      severity: 'RESET',
      desc: 'Abnormal discharge pipe temperature. Often related to extreme weather or a partial blockage.',
      tip: 'Allow the unit to rest for 30 minutes. Ensure indoor filters are clean to maintain proper airflow.',
    },
    {
      code: 'H6',
      title: 'No DC Current Detection',
      severity: 'TECH',
      desc: 'Motor lock or wiring fault. Do not attempt to reset repeatedly.',
      tip: 'A failed motor or wiring fault requires hands-on inspection. Schedule a technician visit.',
    },
    {
      code: 'P1',
      title: 'Insufficient Voltage',
      severity: 'RESET',
      desc: 'Voltage supply is unstable. Check power source.',
      tip: 'Use a stabilizer if voltage fluctuations are common in your area, then power cycle the unit.',
    },
    {
      code: 'U4',
      title: 'Communication Error',
      severity: 'RESET',
      desc: 'Interconnection error between indoor and outdoor units.',
      tip: 'Turn off both indoor and outdoor units for 5 minutes, then restart from the breaker.',
    },
  ],
  Carrier: [
    {
      code: 'E1',
      title: 'Indoor Sensor Fault',
      severity: 'RESET',
      desc: 'Indoor air-temperature sensor is reporting an out-of-range value.',
      tip: 'Power cycle the unit. If the code returns, the sensor likely needs replacement.',
    },
    {
      code: 'E2',
      title: 'Coil Sensor Fault',
      severity: 'TECH',
      desc: 'Indoor coil sensor open / short detected.',
      tip: 'Continuous operation may freeze the coil. Schedule a technician visit.',
    },
    {
      code: 'E5',
      title: 'Compressor Overload',
      severity: 'TECH',
      desc: 'Outdoor unit overload protection triggered.',
      tip: 'Allow the unit to rest for 30 minutes; verify outdoor airflow is unobstructed before restart.',
    },
  ],
  Voltas: [
    {
      code: 'E1',
      title: 'Indoor PCB Fault',
      severity: 'TECH',
      desc: 'Indoor PCB malfunction detected.',
      tip: 'PCB replacement typically required. Schedule a technician visit.',
    },
    {
      code: 'E5',
      title: 'Overload Protection',
      severity: 'RESET',
      desc: 'Compressor overload protection has tripped.',
      tip: 'Power off for 15 minutes, ensure outdoor unit airflow is unobstructed, then restart.',
    },
    {
      code: 'E6',
      title: 'Communication Error',
      severity: 'RESET',
      desc: 'Indoor ↔ outdoor communication failure.',
      tip: 'Check cable connections. Power cycle for 5 minutes and try again.',
    },
  ],
  Samsung: [
    {
      code: 'E2',
      title: 'Indoor PCB Error',
      severity: 'TECH',
      desc: 'Indoor PCB self-diagnostic failure.',
      tip: 'Hardware replacement typically needed. Schedule a technician visit.',
    },
    {
      code: 'E4',
      title: 'High Pressure',
      severity: 'RESET',
      desc: 'High-pressure switch actuated.',
      tip: 'Clear debris around the outdoor unit, wash the condenser coil, and reset.',
    },
    {
      code: 'C4',
      title: 'Outdoor Temp Sensor',
      severity: 'TECH',
      desc: 'Outdoor temperature sensor open / short.',
      tip: 'Sensor replacement required. Schedule a technician visit.',
    },
  ],
  LG: [
    {
      code: 'CH01',
      title: 'Indoor Sensor Error',
      severity: 'RESET',
      desc: 'Indoor unit air-temperature sensor fault.',
      tip: 'Power cycle the unit. If the code persists, the sensor needs to be replaced.',
    },
    {
      code: 'CH02',
      title: 'Outdoor Sensor Error',
      severity: 'TECH',
      desc: 'Outdoor unit sensor fault.',
      tip: 'Sensor replacement is typically needed. Schedule a technician visit.',
    },
    {
      code: 'CH05',
      title: 'Communication Error',
      severity: 'RESET',
      desc: 'Indoor ↔ outdoor unit communication failure.',
      tip: 'Power off both units for 5 minutes, then restart from the breaker.',
    },
    {
      code: 'CH38',
      title: 'Outdoor Unit Error',
      severity: 'TECH',
      desc: 'Outdoor unit self-diagnostic flag set.',
      tip: 'Outdoor PCB / compressor inspection required. Schedule a technician visit.',
    },
  ],
};

/** Look up a code across all brands; returns first match or null. */
export function lookupErrorCode(code: string | null | undefined): (ErrorCodeEntry & { brand: ErrorCodeBrand }) | null {
  if (!code) return null;
  const needle = code.toUpperCase().trim();
  for (const brand of Object.keys(ERROR_CODES) as ErrorCodeBrand[]) {
    const hit = ERROR_CODES[brand].find((c) => c.code.toUpperCase() === needle);
    if (hit) return { ...hit, brand };
  }
  return null;
}
