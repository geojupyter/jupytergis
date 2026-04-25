import React, { useState } from 'react';

const execute = (message: string) => {
    console.log(message);
};

const Form = () => {
    const [message, setMessage] = useState('');
    return (
        <div>
            <label htmlFor="message">Message</label>
            <input id="message" type="text" placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} />
            <button onClick={() => execute(message)}>Generate</button>
        </div>
    );
};

export default { label: 'Log to Console', form: Form, execute };
