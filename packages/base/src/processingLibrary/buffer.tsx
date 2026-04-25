export default {
    label: 'Buffer',
    form: ()=>(
        <div>
            <label htmlFor="distance">Distance</label>
            <div>
                <input id="distance" type="number" />
                <input id="unit" type="text" placeholder="Unit" />
            </div>
        </div>
    ),
    execute: () => {},
};