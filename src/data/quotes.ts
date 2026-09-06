const CORE_QUOTES = [
  "今天的努力，会成为明天从容的底气。", "慢慢来，稳稳做，每一步都算数。", "把平凡的日子过得认真，就是很了不起的坚持。", "愿你眼里有光，心中有爱，脚下有路。", "先完成，再完美；先行动，再调整。", "温柔坚定地做好今天的事。", "每一次耐心的回应，都是成长的种子。", "把小事做好，把日子过亮。", "你正在成为学生记忆里温暖的大人。", "今天也要给自己一点掌声。", "专注当下，答案会在路上出现。", "愿每一份付出都被看见，也被自己珍惜。", "有条理地生活，也有余地地呼吸。", "不急着证明，持续做好就很有力量。", "一件件完成，一点点靠近理想。", "保持热爱，认真生活。", "你所教会孩子的，也在塑造更好的自己。", "今天的阳光，适合重新出发。", "把复杂的事拆小，把重要的事做好。", "愿你忙而不乱，累而有光。",
];

const SUBJECTS = ["认真准备的每一堂课", "耐心回应的每一次提问", "清晨第一束光", "教室里的每一个小进步", "今天完成的一件小事", "给学生的一句鼓励", "井然有序的工作安排", "忙碌之后的片刻安静", "一次真诚的沟通", "愿意重新开始的勇气"];
const ACTIONS = ["会慢慢积累成值得回望的成长。", "都在为更好的明天铺路。", "值得被认真对待，也值得被温柔记住。", "会在不经意间带来惊喜。", "让平凡的日子有了清晰的方向。", "是你送给自己最可靠的礼物。", "会成为孩子心里温暖的底色。", "无需喧哗，也自有坚定的力量。", "正在把理想的模样一点点变成现实。", "提醒我们，持续本身就是答案。"];
const QUOTES = Array.from({ length: 2000 }, (_, index) => CORE_QUOTES[index % CORE_QUOTES.length] ?? `${SUBJECTS[Math.floor(index / ACTIONS.length) % SUBJECTS.length]}${ACTIONS[index % ACTIONS.length]}`);

function hash(value: string) { let result = 0; for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0; return Math.abs(result); }
export function dailyQuote(date = new Date()) { const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; return QUOTES[hash(key) % QUOTES.length]; }
