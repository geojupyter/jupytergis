import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft color="currentColor" />,
        IconRight: ({ ...props }) => <ChevronRight color="currentColor" />
      }}
      modifiersStyles={{
        selected: {
          backgroundColor: 'var(--jp-layout-color2)',
          color: 'var(--jp-ui-font-color0)',
          borderRadius: '0.275rem'
        }
      }}
      styles={{
        root: {
          width: 'max-content',
          margin: 0,
          color: 'var(--jp-ui-font-color0)',
          background: 'var(--jp-layout-color0)',
          border: '1px solid var(--jp-border-color0)',
          borderRadius: 'var(--jp-border-radius)',
          padding: '0.5rem',
          position: 'relative'
        },
        table: {
          paddingTop: '1rem'
        },
        head_cell: {
          color: 'var(--muted-foreground)',
          fontSize: '0.8rem',
          fontWeight: 400
        },
        day: {
          backgroundColor: 'var(--jp-layout-color0)',
          display: 'flex',
          justifyContent: 'center',
          border: 'none',
          padding: '0.5rem',
          margin: 'auto',
          fontSize: '0.8rem'
        },
        caption: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        nav_button_previous: {
          color: 'var(--jp-ui-font-color0)',
          background: 'transparent',
          border: '0.5px solid var(--jp-border-color0)',
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          borderRadius: 'var(--jp-border-radius)',
          padding: '0.175rem',
          width: 'max-content',
          height: 'max-content'
        },
        nav_button_next: {
          color: 'var(--jp-ui-font-color0)',
          background: 'transparent',
          border: '0.5px solid var(--jp-border-color0)',
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          borderRadius: 'var(--jp-border-radius)',
          padding: '0.175rem',
          width: 'max-content',
          height: 'max-content'
        }
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export default Calendar;
