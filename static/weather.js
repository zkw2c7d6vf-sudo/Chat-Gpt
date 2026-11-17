(function(root) {
  'use strict';
  const asDate=value=>typeof value==='number' ? new Date(value*1000) : new Date(value);
  const formatters=new Map(), hourIndexes=new WeakMap();
  function key(value,timeZone) {
    let formatter=formatters.get(timeZone);
    if (!formatter) {
      formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
      if (formatters.size>=16) formatters.delete(formatters.keys().next().value);
      formatters.set(timeZone,formatter);
    }
    const parts=formatter.formatToParts(asDate(value));
    return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
  }
  function selectDay(data,index,timeZone) {
    const daily=data?.daily,hourly=data?.hourly || {};
    if (!daily?.time || !Number.isInteger(index) || index<0 || index>=daily.time.length) return null;
    const date=asDate(daily.time[index]),dayKey=key(daily.time[index],timeZone);
    const sunrise=daily.sunrise?.[index],sunset=daily.sunset?.[index];
    // Forecast responses are immutable snapshots; new responses get a new index.
    let indexCache=hourIndexes.get(hourly);
    if (!indexCache || indexCache.timeZone!==timeZone) {
      const days=new Map();
      (hourly.time || []).forEach((time,i)=>{
        const day=key(time,timeZone);
        if (!days.has(day)) days.set(day,[]);
        days.get(day).push({time,i});
      });
      indexCache={timeZone,days}; hourIndexes.set(hourly,indexCache);
    }
    const hours=(indexCache.days.get(dayKey) || []).map(({time,i})=>({time:asDate(time),temperature:hourly.temperature_2m?.[i],code:hourly.weather_code?.[i] ?? 3,rain:hourly.precipitation_probability?.[i],isDay:sunrise!=null && sunset!=null && asDate(time)>=asDate(sunrise) && asDate(time)<asDate(sunset)}));
    return {date,dayKey,index,high:daily.temperature_2m_max?.[index],low:daily.temperature_2m_min?.[index],rain:daily.precipitation_probability_max?.[index],code:daily.weather_code?.[index] ?? 3,sunrise,sunset,hours};
  }
  const api={selectDay,key}; root.MidnightWeather=api;
  if (typeof module!=='undefined') module.exports=api;
})(globalThis);
