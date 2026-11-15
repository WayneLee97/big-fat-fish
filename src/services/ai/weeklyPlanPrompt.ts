export function buildWeeklyPlanRequest(names: string[], now = new Date()) {
  const classNames = [...new Set(names.map(name => name.trim()).filter(Boolean))];
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return {
    classNames,
    currentWeek: { start: date(monday), end: date(sunday) },
    request: `这个是学校的每周计划，帮我找出：
1、${classNames.length ? `${classNames.join('、')}相关的事项。` : '当前尚未添加班级，不推测所属班级，暂不筛选特定班级事项。'}
2、我也是数学老师，帮我找出本周和数学教学相关的活动。
3、有学校公共活动的（所有人员或者所有老师参加的），也找出来。
最后返回事项信息（包括日期和时间），供我自行选择相关事项添加到日历。`,
  };
}
