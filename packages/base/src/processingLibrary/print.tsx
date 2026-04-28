import React, { useState } from 'react';

const Form = ({ onExecute }: { onExecute: (message: string) => void }) => {
    const [message, setMessage] = useState('');
    return (
        <div>
            <label htmlFor="message">Message</label>
            <input id="message" type="text" placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} />
            <button onClick={() => onExecute(`print('${message}')`)}>Generate</button>
        </div>
    );
};

export default { label: 'Print', form: Form };
