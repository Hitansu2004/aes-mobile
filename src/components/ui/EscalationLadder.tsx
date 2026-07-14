import React from 'react';
import { View } from 'react-native';
import { MotiView } from 'moti';
import {
  AlertCircle, Check, Clock, Info,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives';
import { radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { formatRemaining } from '@/hooks/useSlaCountdown';

// Ported from ../../aes-frontend/src/components/ui/EscalationLadder.js +
// EscalationLadder.module.css. Levels/copy/tone logic copied verbatim.
// MOTION: framer-motion's staggered fade-slide-in maps to Moti
// from/animate + delay; the "active" dot's white pulse dot is a Moti loop.
const TIERS = [
  {
    level: 1,
    title: 'Level 1 — CRM Team',
    standbyDesc: 'Initial response & triage',
    activeDesc: 'Currently handling your ticket',
    pastDesc: 'Did not respond within 30 minutes',
  },
  {
    level: 2,
    title: 'Level 2 — Service Managers',
    standbyDesc: 'Auto-escalates if no CRM response in 30 min',
    activeDesc: 'Service managers handling your ticket',
    pastDesc: 'Service managers escalated to management',
  },
  {
    level: 3,
    title: 'Level 3 — Management',
    standbyDesc: 'Escalates if unresolved after Level 2',
    activeDesc: 'Management is handling your ticket',
    pastDesc: 'Resolved by management',
  },
];

type Phase = 'past' | 'active' | 'standby';

export interface EscalationLadderProps {
  currentLevel?: 1 | 2 | 3;
  slaRemainingSeconds?: number | null;
  acknowledgedAtCurrentLevel?: boolean;
}

export function EscalationLadder({
  currentLevel = 1, slaRemainingSeconds = null, acknowledgedAtCurrentLevel = false,
}: EscalationLadderProps) {
  const { tokens } = useTheme();

  return (
    <View>
      {TIERS.map((t, idx) => {
        let phase: Phase;
        if (t.level < currentLevel) phase = 'past';
        else if (t.level === currentLevel) phase = 'active';
        else phase = 'standby';

        const dotStyle = phase === 'active'
          ? { borderColor: '#C9A84C', backgroundColor: '#C9A84C' }
          : phase === 'past'
            ? { borderColor: tokens.colors.success, backgroundColor: tokens.colors.success }
            : { borderColor: tokens.colors.outlineVariant, backgroundColor: tokens.colors.surface };

        const connectorColor = phase === 'active' ? '#C9A84C' : phase === 'past' ? tokens.colors.success : tokens.colors.outlineVariant;
        const titleColor = phase === 'active' ? '#7A5F1E' : tokens.colors.onSurface;
        const bodyOpacity = phase === 'standby' ? 0.65 : phase === 'past' ? 0.85 : 1;

        return (
          <MotiView
            key={t.level}
            from={{ opacity: 0, translateX: -10 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: idx * 60 }}
            style={{
              flexDirection: 'row', gap: 12, paddingBottom: idx === TIERS.length - 1 ? 8 : 18,
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: 4, width: 18 }}>
              <View
                style={[
                  {
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  dotStyle,
                  phase === 'active' && {
                    shadowColor: '#C9A84C', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                {phase === 'past' && <Check size={12} strokeWidth={3} color="#ffffff" />}
                {phase === 'active' && (
                  <MotiView
                    from={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 1.4, opacity: 0.6 }}
                    transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
                    style={{
                      width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff',
                    }}
                  />
                )}
              </View>
              {idx < TIERS.length - 1 && (
                <View style={{
                  flex: 1, width: 2, marginTop: 4, borderRadius: 1, backgroundColor: connectorColor, minHeight: 24,
                }}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: 4, opacity: bodyOpacity }}>
              <Text style={{ fontSize: 14, fontFamily: font('body', 700), color: titleColor, marginBottom: 2, letterSpacing: -0.14 }}>
                {t.title}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: tokens.colors.onSurfaceVariant }}>
                {phase === 'active' && t.activeDesc}
                {phase === 'past' && t.pastDesc}
                {phase === 'standby' && t.standbyDesc}
              </Text>

              {phase === 'active' && slaRemainingSeconds != null && !acknowledgedAtCurrentLevel && (
                <View style={{
                  marginTop: 6, flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: '#fff8f0',
                }}
                >
                  <Clock size={14} color="#b45309" />
                  <Text style={{ fontSize: 12, fontFamily: font('body', 600), color: '#b45309' }}>
                    {`Response expected in ${formatRemaining(slaRemainingSeconds)}`}
                  </Text>
                </View>
              )}
              {phase === 'active' && acknowledgedAtCurrentLevel && (
                <View style={{
                  marginTop: 6, flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: '#dcfce7',
                }}
                >
                  <Check size={14} strokeWidth={3} color="#166534" />
                  <Text style={{ fontSize: 12, fontFamily: font('body', 700), color: '#166534' }}>Acknowledged</Text>
                </View>
              )}
              {phase === 'standby' && (
                <Text style={{
                  marginTop: 4, fontSize: 12, fontStyle: 'italic', color: tokens.colors.outline,
                }}
                >
                  Status: On standby
                </Text>
              )}
              {phase === 'past' && (
                <View style={{
                  marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4,
                }}
                >
                  <AlertCircle size={12} color={tokens.colors.outline} />
                  <Text style={{ fontSize: 12, fontStyle: 'italic', color: tokens.colors.outline }}>
                    Auto-escalated
                  </Text>
                </View>
              )}
            </View>
          </MotiView>
        );
      })}

      <View style={{
        marginTop: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: tokens.colors.surfaceContainer,
      }}
      >
        <Info size={16} color={tokens.colors.onSurfaceVariant} />
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: tokens.colors.onSurfaceVariant }}>
          Escalation is automatic. You will be notified at each step.
        </Text>
      </View>
    </View>
  );
}
