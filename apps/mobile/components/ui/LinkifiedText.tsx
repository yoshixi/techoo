import { Text } from '@/components/ui/text';
import { openInAppBrowser } from '@/lib/openInAppBrowser';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_PART_REGEX = /^https?:\/\/[^\s]+$/;

/** Trim trailing punctuation often pasted after URLs in prose. */
function stripTrailingUrlPunctuation(url: string): string {
  return url.replace(/[.,!?;:)\]]+$/, '');
}

export function LinkifiedText({
  text,
  className,
  linkClassName = 'text-primary underline',
}: {
  text: string;
  className?: string;
  linkClassName?: string;
}) {
  const parts = text.split(URL_REGEX);

  return (
    <Text className={className}>
      {parts.map((part, idx) => {
        if (!URL_PART_REGEX.test(part)) {
          return part;
        }
        const href = stripTrailingUrlPunctuation(part);
        const suffix = part.slice(href.length);
        return (
          <Text key={`link-${idx}`}>
            <Text
              className={linkClassName}
              accessibilityRole="link"
              onPress={() => void openInAppBrowser(href)}
            >
              {href}
            </Text>
            {suffix}
          </Text>
        );
      })}
    </Text>
  );
}
