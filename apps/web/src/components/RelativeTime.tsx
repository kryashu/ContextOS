'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface Props {
  dateStr: string;
}

export default function RelativeTime({ dateStr }: Props) {
  const [display, setDisplay] = useState<string>('');

  useEffect(() => {
    setDisplay(formatRelativeTime(dateStr));
  }, [dateStr]);

  return <>{display}</>;
}
