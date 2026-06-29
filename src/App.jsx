import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════
   SAATHBAN — Timeless Togetherness
   Where Generations Flourish Together
   ════════════════════════════════════════════════ */

// ─── Color Tokens (new brand palette) ───
const C = {
  cream: "#FAF3E9", brown: "#573425", green: "#063214",
  greenLight: "#0a4a1e", greenMuted: "#2a5e3a", brownLight: "#7a5443",
  olive: "#6b7c5e", sage: "#8fa67e", warmGray: "#d4cdc4",
  bg: "#FAF3E9", white: "#FFFFFF", dark: "#1a1a1a",
  textMain: "#2d2418", textMuted: "#6b5e52", accent: "#573425",
};

// ─── Data ───
const FOUNDERS = [
  {
    name: "Tahir Sajeel Farooq",
    role: "Co-Founder",
    img: "/founder2.png",
    bio: "Sajeel is one of the co-founders of Saathban. After graduating from the Lahore University of Management Sciences with a degree in Economics, he was offered a scholarship at the University of Chicago in one of the leading schools of Public Policy. At the University of Chicago, he is working with the world's leading scientists and Nobel laureates to develop technologies to help people in underdeveloped countries live better lives. He has extensive training in microeconomics, politics, and international finance and has a deep understanding of income traps in the developing world. His vision for Saathban is to create a space where people of all ages can connect and share wisdom with each other to make the world a better place. During his time with Saathban, he has helped build a strong organizational foundation, assemble an extraordinary team, and establish the systems that allow the mission to stand on its own feet and grow. He pays his regards to his father, from whom he learned to be kind.",
    message: "Saathban is a sincere gift to the elderly around the world. I hope to see it flourish and grow as a place that has no age limit.",
  },
  {
    name: "Maheen Shafiq",
    role: "Co-Founder",
    img: "/founder1.png", 
    bio: "Maheen co-founded Saathban with a simple belief: thriving societies are built not on generational separation, but on intergenerational connection. Her past experience involves dedicated work as a risk and implementation consultant for financial and non-financial institutions to architect systems that withstand systemic shocks. This expertise she is now applying to vanquish the risk and impact of isolation by building a community rooted in sustainable connections. Under her leadership, Saathban has mobilized a growing network of volunteers and is building new models of intergenerational connection that seek to redefine what it means to age in the modern world.",
    message: "The future of humanity depends not only on how long we live, but on how meaningfully we remain connected across generations. Our mission is to transform aging from an experience of gradual social invisibility into one of continued purpose, community, and human connection. We are working toward a world where elders are not merely cared for, but celebrated as active, connected, and essential members of society.",
  },
];

const TEAM = [
  { name: "Tahir Sajeel Farooq", role: "Co-Founder", initials: "TSF", color: C.green, img: "/founder2.png" },
  { name: "Maheen Shafiq", role: "Co-Founder", initials: "MS", color: C.brown, img: "/founder1.png" },
  { name: "Hamayoon Shah", role: "Chief Research Officer", initials: "CRO", color: C.greenMuted, img: "/research.png" },
/*{ name: "Research Assistant", role: "Research Assistant", initials: "RA", color: C.olive },
  { name: "Design Associate", role: "Design Associate", initials: "DA", color: C.sage }, 
  { name: "Strategy Associate", role: "Strategy Associate", initials: "SA", color: C.brownLight, img: null }, */
];
//-- Events --
// to add a new event: copy one object below and fill in the details
const EVENTS = [
  {
    id: "chai-conversations-lahore",
    title: "Chai & Conversations — Lahore",
    date: "Mar 22, 2025",
    loc: "Alhamra Arts Council, Lahore",
    desc: "An afternoon of storytelling and warm chai with senior residents of local aged care homes in Lahore.",
    color: C.brown,
    detail: {
      fullDate: "Saturday, 22nd March 2025",
      time: "3:00 PM – 5:00 PM",
      venue: "Alhamra Arts Council, Mall Road, Lahore",
      about: `Chai & Conversations was Saathban's first community event in Lahore. A warm, intimate afternoon bringing together senior residents from local aged care homes and young volunteers from universities across the city.\n\nOver steaming cups of chai and homemade biscuits, our Saath-Icons shared stories from their lives; tales of Partition, of building careers and families, of the Lahore they once knew. Our Saath-Buddies listened, laughed, and left changed.\n\nThe event reminded us why Saathban exists: not to deliver a service, but to restore a connection.`,
      highlights: [
        "30+ senior citizens attended from 3 local aged care homes",
        "20 student volunteers from LUMS",
        "Handwritten letters exchanged between Saath-Buddies and Saath-Icons",
      ],
      agenda: [
        { time: "3:00 PM", item: "Arrival & welcome tea" },
        { time: "3:30 PM", item: "Opening remarks by Saathban co-founders" },
        { time: "4:15 PM", item: "Letter-writing activity" },
        { time: "4:45 PM", item: "Group photo & closing chai" },
      ],
      gallery: [
        { label: "Welcome gathering", emoji: "🫖" },
        { label: "Storytelling circle", emoji: "💬" },
        { label: "Ghazal performance", emoji: "🎵" },
        { label: "Letter writing", emoji: "✉️" },
      ],
      quote: { text: "I haven't laughed like that in years. These young people gave me something I didn't know I was missing.", author: "Saath-Icon, 74, Lahore" },
    },
  },
  {
    id: "bridging-generations-workshop",
    title: "Bridging Generations Workshop",
    date: "May 3, 2026",
    loc: "Virtual Event",
    desc: "Interactive workshop pairing Saath-Buddies with Saath-Icons for meaningful intergenerational dialogue.",
    color: C.green,
    detail: null, // upcoming — no detail page yet
  },
  {
    id: "walk-with-me",
    title: "Walk With Me — Senior Wellness Walk",
    date: "Jun 15, 2026",
    loc: "Lahore Canal Bank",
    desc: "A gentle group walk promoting physical and mental health among senior citizens.",
    color: C.olive,
    detail: null,
  },
];

// ─── Blog Data ───
const BLOGS = [
    {
    id: "how-egalitarian-is-pakistan",
    title: "How Egalitarian is Pakistan in the Inegalitarian World",
    date: "June 22, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "3 min read",
    tag: "Research",
    color: C.brown,
    excerpt: "Pakistan appears relatively equal on paper, but a closer look reveals a much sharper divide.",
    coverImg: "/blog_images/blog_8.png",
    content: [
      {
        type: "lead",
        text: "For the first time on this planet, a man has finally crossed the figure of one trillion dollars in wealth, and that man is Elon Musk. To put this in perspective for a reader in Pakistan, our entire GDP is about 452 billion dollars, meaning this fortune is more than double the size of a nation of around 259 million people. In other terms, of the 195 sovereign recognized nations in the world today, only 21 have a GDP above one trillion dollars. The remaining 174 each have a nominal GDP worth less than the fortune of one man. To add a little more spice to this, eradicating extreme poverty worldwide would cost roughly 70 to 325 billion dollars a year, according to a UNU-WIDER paper. Even at its highest estimate, that is barely a quarter of what this one man is worth."
      },
      {
        type: "paragraph",
        text: "A fortune like this does not appear out of nowhere. It is the visible result of a pattern economists have studied for years. The clearest explanation comes from Thomas Piketty, whose central idea is simple. When the money already held as wealth grows faster than the wider economy, the people who own that wealth pull ahead of the people who live on wages. Earning a salary can no longer keep pace with owning capital, so over time the richest do not just stay rich, they get richer automatically. Piketty captures this in a short formula, r greater than g, where r is the return on capital and g is the growth of the economy. Across most rich economies, the capital-to-income ratio has climbed back to levels last seen before the First World War, above 600 percent in France and close to 500 percent in Britain and the United States. Money, in other words, is once again outpacing work."
      },
      {
        type: "pullquote",
        text: "When returns on capital stay higher than economic growth for a long time, trillion-dollar fortunes are what the system eventually produces."
      },
      {
        type: "paragraph",
        text: "The Gini coefficient is the most common way to measure inequality, but it does not show the full picture. It turns a complex distribution into a single number, which can hide how much wealth is concentrated at the very top. The World Inequality Lab uses a clearer breakdown: the bottom 50 percent, the middle 40 percent, and the top 10 percent. Globally, the top 10 percent receive about 53 percent of all income and hold nearly 75 percent of all wealth. In contrast, the bottom half gets only around 8 percent of income and just about 2 percent of wealth. At the very top, inequality becomes even sharper. The richest 0.001 percent now hold around 6 percent of global wealth, up from less than 4 percent in the mid-1990s, while the bottom half of the world has stayed near the same level of 2%."
      },
      {
        type: "paragraph",
        text: "Pakistan follows a similar pattern, even though its Gini score of 33.5 makes it seem more equal. However, if we divide the population into centiles and deciles using the World Inequality Lab data, the top 10 percent of earners take about 41.7 percent of national income, while the bottom 50 percent receive only 19.4 percent, which means the richest tenth earn more than the entire bottom half put together. In absolute terms, the average person in the top 1 percent earns around 21.65 million PKR a year, compared with just 260,000 PKR for someone in the bottom half, a gap of roughly 83 times. Wealth is skewed even further. The top 1 percent own close to a quarter of everything, and the average person in that group holds about 119.79 million PKR in wealth against just 235,000 PKR for someone in the bottom half, a difference of more than 500 times."
      },
      {
        type: "pullquote",
        text: "The richest tenth earn more than the entire bottom half put together."
      },
      {
        type: "paragraph",
        text: "Which returns us to where we began. Elon Musk is not an exception to the system. He is the outcome of it. When returns on capital stay higher than economic growth for a long time, trillion-dollar fortunes are what the system eventually produces. But this is not a problem that sits apart from everything else. It is bound up with the larger social challenges of our time, from poverty and out-of-school children to the health and support of a rapidly ageing global population. Economists like Piketty have given us the numbers, and those numbers are striking, but the real work lies beyond them. Meeting these challenges depends on strong institutions, public and private, willing to take them on. We believe Saathban is one of those institutions, working to support the elderly who too often end up at the forgotten end of this divide."
      }
    ]
  },
  {
    id: "kodokushi-silent-experience",
    title: "Kodokushi: The Silent Experience of Living Unnoticed in Later Years",
    date: "June 15, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "4 min read",
    tag: "Research",
    color: C.brown,
    excerpt: "What happens when longer lives outpace the systems and relationships needed to support them?",
    coverImg: "/blog_images/blog_7.png",
    content: [
      {
        type: "lead",
        text: "Imagine waiting for a food delivery person, not just for food, but so that you get a chance to talk to someone in the world of solitude you are living in. In Japan, Yakult Ladies, a company delivering probiotic drinks, have become an unlikely source of community and companionship. They have expanded their role from not just delivery, but also talking to elderly people living alone. This delivery structure has now become a form of social infrastructure."
      },
      {
        type: "paragraph",
        text: "Kodokushi, a phenomenon of dying in solitude, has become a growing crisis in Japan, where a large share of the population is elderly, reflected in its median age of 50.2, one of the highest in the world. According to figures issued by the Government of Japan and reported by DW, 76,941 people died alone last year. A further unfortunate and striking fact is that many of these bodies were not discovered for at least a week. The police also use a special term, “koritsushi,” for cases where bodies are found more than eight days after death. Even more concerning reality is that approximately 9% of these cases, around 7,148 people, were discovered only after a month. According to estimates by Japan’s Cabinet Office and reports from Nippon.com, the majority of unattended deaths occur among the elderly. The most affected age group is those aged 85 and above, with 15,079 cases, followed by people aged 75 to 79 with 13,412 cases, and those aged 80 to 84 with 11,366 cases. In total, individuals aged 65 and above account for 58,919 cases, making up nearly 80% of all unattended deaths."
      },
      {
        type: "pullquote",
        text: "In total, individuals aged 65 and above account for 58,919 cases, making up nearly 80% of all unattended deaths."
      },
      {
        type: "paragraph",
        text: "According to the BBC report the Yakult launched their barnd in 1971 of probiotic drinks to help the children survive with healthy gut and longer life moto. Who knew back then that the Yakult Ladies would one day be visiting the same people, who were children in the 1960s and are now elderly today, providing not just probiotic drinks but also a few precious minutes of human company in an increasingly lonely world? An 83-year-old woman, Furuta, told the BBC that she has stayed healthy because she has always been drinking Yakult probiotic drinks, but said it is not just the drink anymore, as the visits themselves also make her feel healthier."
      },
      {
        type: "pullquote",
        text: "The visits themselves also make her feel healthier."
      },
      {
        type: "paragraph",
        text: "Our enormous leap in pharma, biotechnology, and medicine has made us healthier and helped us live longer, no doubt. But it also feels like we are not fully prepared for what comes after that. Elderly care has not kept pace, and loneliness along with mental health issues among older people has become a deeply disturbing phenomenon in countries with aging populations. Saathban might be a novel idea for many in Pakistan, an overambitious project for some, and a useless endeavor for a few. But Saathban is a necessity of the day. What Yakult Ladies stumbled into by chance, Saathban is doing by design. Every elderly person sitting alone, waiting for anyone at the door, deserves more than a delivery. They deserve a conversation, a presence, a connection. Saathban needs your support so that we can reach every single lonely elder who is still waiting for that knock on the door."
      }
    ]
  },
  {
    id: "global-capital-tax",
    title: "The Case for a Global Capital Tax",
    date: "June 08, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "5 min read",
    tag: "Research",
    color: C.olive,
    excerpt: "A closer look at how modern wealth escapes taxation and why global coordination may be the missing piece in fixing inequality.",
    coverImg: "/blog_images/blog_6.png",
    content: [
      {
        type: "lead",
        text: "The world has progressive taxation systems, and many assume that the wealthy therefore pay their fair share. But what if I told you the top brass of the richest pay almost no tax at all? You might dismiss that claim as pessimistic, anti-business, or even \"woke.\" Yet this is not a story about tax evasion or hidden money in offshore tax havens. It is about perfectly legal arrangements embedded within modern tax systems."
      },
      {
        type: "paragraph",
        text: "Consider the case of Liliane Bettencourt, whose fortune was estimated at around €30 billion. Despite her immense wealth, only a tiny fraction of that fortune was ever exposed to income taxation. In some years, less than one-thousandth of her wealth appeared in taxable income. To put this into perspective, if someone possessed $1 million in wealth, only about $1,000 of it would be subject to income tax. The result is a striking gap between economic wealth and taxable income, a gap that lies at the heart of today's debate over inequality and taxation."
      },
      {
        type: "paragraph",
        text: "ProPublica obtained the actual IRS records of the wealthiest Americans, and the findings detonated the polite fiction that the rich simply pay more. The 25 wealthiest people in America saw their fortunes rise by $401 billion between 2014 and 2018, yet they paid a combined federal income tax rate of just 3.4 percent when measured against that wealth growth. Remember, not the wealth itself, but the wealth growth. For comparison, a salaried nurse or teacher routinely surrenders 20 to 25 percent of their income once federal and payroll taxes are combined."
      },
      {
        type: "paragraph",
        text: "Elon Musk, Bill Gates, Larry Ellison, Jeff Bezos, Gautam Adani, Mukesh Ambani, and thousands of other wealthy individuals hold most of their wealth in the form of capital assets, primarily stocks and real estate. While real estate is subject to property taxes in some countries, these taxes are often levied at very low rates. The bulk of their wealth remains largely untouched by taxation."
      },
      {
        type: "paragraph",
        text: "Governments typically have only two opportunities to tax this wealth meaningfully: when assets are sold and capital gains are realized, or when wealth is transferred upon death through estate or inheritance taxes. Until then, vast fortunes can continue to grow for decades with little direct taxation."
      },
      {
        type: "paragraph",
        text: "Indeed, taxation is both a political and philosophical subject, and not an easy one for politicians who must simultaneously secure the support of the public and the backing of powerful financial interests. This issue is also global in nature. While globalization could, in principle, help improve coordination and fairness in taxation, it has also made it easier for the wealthy to move capital across borders. In the form of capital flight and financial mobility, globalization has weakened the ability of governments to introduce effective capital or wealth taxes, as assets can often be relocated or restructured in response to policy changes.alization has further complicated this picture. While it has enabled economic growth and integration, it has also made it easier for capital to move across borders, weakening the ability of individual states to implement effective wealth taxation."
      },
      {
        type: "pullquote",
        text: "A rate as low as 0.1 percent on global capital could transform not just revenue systems, but the very idea of fairness in taxation."
      },
      {
        type: "paragraph",
        text: "If we want a more egalitarian world, with governments having enough resources to spend on social issues, then according to Thomas Piketty one solution could be a fair global capital tax. Indeed, a global capital tax would not be an easy step for a world as divided as the one we see today, drenched in wars. But we have experienced immense progress and transformation over the past two centuries, and this could prove to be the case here as well.nomist Thomas Piketty has argued that a global capital tax could address these structural imbalances. However, such a system would require unprecedented international coordination and transparency, including shared financial registries that make ownership of assets visible across jurisdictions."
      },
      {
        type: "paragraph",
        text: "To levy even a modest tax on capital, governments would first need to know who owns what and where, which means a shared financial register and an end to the opacity that lets great fortunes slip between jurisdictions. In Piketty's vision the tax is therefore as much a tool of transparency as of revenue. A low rate could begin gently, climbing for the very largest fortunes, so that a teacher's modest savings are barely touched while billion-euro holdings finally contribute their share."
      },
      {
        type: "paragraph",
        text: "Critics will rightly note that no such tax can work if one country can simply undercut another, which is precisely why coordination matters more than the rate itselfritics rightly point out that any unilateral attempt would fail, as capital would simply shift to lower-tax jurisdictions. This is why coordination is central: without it, even well-designed policies lose effectiveness in a globally mobile financial system."
      },
      {
        type: "paragraph",
        text: "Yet the same was once said of cross-border banking rules and the automatic exchange of tax information, both once dismissed as utopian and both now a reality. A global capital tax may seem distant today, but history suggests that what looks impossible in one generation can become ordinary in the next."
      },
      {
        type: "paragraph",
        text: "At Saathban, we believe that same conviction holds closer to home: that resources, fairly gathered, are what will allow governments to meet the needs of a rapidly growing aged population, so that no elderly person is left without care in the years when they need it most."
      }
    ],
  },
  {
    id: "smartphone-and-birth-rates",
    title: "The World's Vanishing Births: Is the Smartphone Part of the Answer?",
    date: "June 12, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "4 min read",
    tag: "Research",
    color: C.sage,
    excerpt: "A new explanation for falling birth rates may be sitting in our pockets.",
    coverImg: "/blog_images/blog_5.png",
    content: [
      {
        type: "lead",
        text: "We are curious creatures. We like to think, question, and make sense of the world. But our brain also prefers simple answers. Simple explanations feel clean and satisfying. This may be one reason why conspiracy theories often attract people. They offer easy answers without much effort or complexity. But reality is rarely that simple. When we test ideas carefully and study them in a systematic way, many of our neat stories fall apart. What looked clear at first often turns out to be far more complicated than we imagined."
      },
      {
        type: "paragraph",
        text: "Population is one of those puzzles. For most of history, we explained it through clear forces. War. Famine. Disease. Even something as small as a mosquito. Then, in the twentieth century, a new idea took hold. As countries grew richer and safer, people would simply choose to have fewer children. Comfort would do what catastrophe once did. But what if that story no longer holds? What if something else is now driving the change, something that cuts across rich and poor alike?"
      },
      {
        type: "pullquote",
        text: " In more than two-thirds of the world's 195 countries, women now have fewer children than the 2.1 needed to keep a population stable."
      },
      {
        type: "paragraph",
        text: "A new explanation has emerged in recent research. It points to something many of us carry in our pockets. But first, look at how strange the puzzle has become. In 66 countries, the average is closer to one than to two. We used to think of this as a rich-country worry. Not anymore. In 2023, Mexico's birth rate fell below that of the United States for the first time. Brazil, Tunisia, Iran, and Sri Lanka soon followed. Many poorer countries are now growing old before they grow rich."
      },
      {
        type: "paragraph",
        text: "What makes this so hard to explain is that the usual answers do not fit. Since the 1980s, wealthy countries have tripled what they spend per person on child benefits, childcare, and parental leave. Birth rates fell anyway, from 1.85 to 1.53 per woman. Housing is part of the story. A Financial Times analysis suggests that up to half the fertility decline in countries like the US and UK since the 1990s comes down to falling home ownership and young adults staying longer with their parents. But that still cannot explain the latest drop. Births have fallen even in the Nordic countries, where housing is stable and young people live on their own."
      },
      {
        type: "paragraph",
        text: "The deeper change is not that couples are having fewer children. It is that there are fewer couples at all. A study by demographer Stephen Shaw shows something striking. In most rich countries, the number of children mothers have has held steady, or even risen. What has fallen is the share of women who have any children at all. Had marriage and cohabitation rates simply stayed flat in the US over the past decade, the birth rate today would be higher than it was ten years ago."
      },
      {
        type: "paragraph",
        text: "This is where the smartphone enters the story. Nathan Hudson and Hernan Moscoso-Boedo of the University of Cincinnati studied birth rates against the rollout of 4G networks. Births fell first, and fell fastest, in the places that got high-speed mobile internet earliest. They argue that smartphones changed how young people spend their time. People stopped meeting in person."
      },
      {
        type: "paragraph",
        text: "The same pattern shows up around the world. Birth rates among young adults in the US, UK, and Australia were flat in the early 2000s, then began falling around 2007. France and Poland followed around 2009. Mexico and Indonesia around 2012. Ghana, Nigeria, and Senegal saw sharp drops between 2013 and 2015. Each turning point lined up with the moment smartphones went mainstream in that country."
      },
      {
        type: "paragraph",
        text: "The reason seems simple, and very human. People spend less time together. In South Korea, in-person socialising among young adults has halved in twenty years. As demographer Lyman Stone puts it, finding a partner means sorting through a lot of people. If you socialise far less, that search takes much longer. Sometimes it never ends. He makes another sharp point. Spend time with real people, and your expectations stay grounded. Spend your time on Instagram, and your standards drift toward something that does not exist."
      },
      {
        type: "paragraph",
        text: "The effect is strongest where you might least expect it. Stanford's Alice Evans argues that the more traditional a culture's gender roles, the bigger the impact of smartphones. She calls it 'cultural leapfrogging.' Apps like Instagram and TikTok let young women skip past old expectations and raise their hopes for a relationship faster than the men around them adjust. The data fits. Some of the steepest declines of the past decade are in the Middle East and Latin America. Finnish demographer Anna Rotkirch adds another piece: sexual problems are more common among the young adults who use social media most."
      },
      {
        type: "paragraph",
        text: "But the smartphone is not a lone villain. That would be exactly the kind of tidy answer we should distrust. Older technology left its mark too. Back in 2001, researchers Robert Hornik and Emile McAnany found a stronger link between falling birth rates and owning a television than between birth rates and income or education. A later study by Eliana La Ferrara and colleagues found that soap operas showing small families led women to have fewer children. And in 2018, Adrienne Lucas and Nicholas Wilson found that owning a TV led couples to have less sex. The smartphone is more personal, more constant, more solitary. It may simply be the same force, only stronger."
      },
      {
        type: "paragraph",
        text: "So what can be done? As Lyman Stone wryly notes, you cannot uninvent the smartphone. If someone has bad eyes, you do not edit their genes. You give them glasses. Secure, affordable housing does help young couples start families. Generous baby bonuses might slow the decline. But these miss the deeper problem. Helping happy couples have children does little for the growing number of people who have no partner at all."
      },
      {
        type: "paragraph",
        text: "That is the real shape of the puzzle. Falling birth rates are not just about babies. They point to something larger, a slow drift toward solitude. People connect less, in person, at every age. And this loneliness does not fade as we grow older. Often it grows worse. The young struggle to find each other. The old are left without company. There is no single cause here, and no single cure. But if screens have pulled us apart, then the answer, though hard, may be simple. We have to find our way back to real, human company. That is the work we care about at Saathban, where our focus is on the elderly, the ones too often left alone at the end."
      }
    ]
  },
  {
    id: "pay-as-you-go",
    title: "Pay-As-You-Go: A System Under Strain",
    date: "May 23, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "4 min read",
    tag: "Policy",
    color: C.green,
    excerpt: "The pension systems that once defined modern welfare states are beginning to crack under the weight of longer lives and shrinking generations.",
    coverImg: "/blog_images//blog_4.png",
    content: [
      {
        type: "lead",
        text: "Imagine being told to hand over a portion of your income each month to support a retired stranger living hundreds of miles away, on the promise that decades from now, someone you will never meet will do the same for you."
      },
      {
        type: "paragraph",
        text: "In a world this unpredictable, doesn't the arrangement start to feel a little strange? Yet this intergenerational solidarity scheme has been at play since the late 19th century and is now in place in almost every country."
      },
      {
        type: "paragraph",
        text: "Herein lies the quiet beauty of the social state. Because today's workers finance today's retirees, the prosperity of the elderly depends directly on the wages, productivity, and sheer number of the young."
      },
      {
        type: "paragraph",
        text: "Suddenly, the state has every reason to invest generously in schools, in universities, in the health of children, and yes, in a higher birth rate too. A bond is forged across generations, each one quietly indebted to the next, and what emerges, at least in principle, is a virtuous and harmonious society held together not by charity but by mutual self-interest."
      },
      {
        type: "pullquote",
        text: "A bond is forged across generations, each one quietly indebted to the next."
      },
      {
        type: "paragraph",
        text: "When it was first introduced, all the conditions for this system were conducive: high demographic growth and high productivity growth, with overall growth rates close to 5% in countries like those of continental Europe."
      },
      {
        type: "paragraph",
        text: "The combination of these two is, in fact, precisely the implicit rate of return of a pay-as-you-go system. Workers who paid in were repaid generously when their turn came to receive. Those who contributed during World War 2 were paid in full or, in some cases, are still receiving payments if alive."
      },
      {
        type: "paragraph",
        text: "And here the story turns. The very conditions that once made pay-as-you-go feel like a stroke of social genius are quietly unraveling."
      },
      {
        type: "paragraph",
        text: "Longevity stretches ever upward, with retirees today drawing pensions for twenty, thirty, sometimes nearly forty years, far longer than Bismarck or Beveridge ever dared to imagine. Birth rates, meanwhile, are collapsing across much of the developed world, often well below the replacement threshold, leaving fewer and fewer young shoulders to carry an ever-heavier load."
      },
      {
        type: "paragraph",
        text: "Productivity growth, once a reliable 4 to 5 percent a year in post-war Europe, has slowed to a crawl. The arithmetic that once made the system feel almost magical now works in reverse: more retirees, fewer workers, and slower wage growth to fund them all."
      },
      {
        type: "pullquote",
        text: "The promise that the next generation would always be there to pay starts to sound less like a guarantee and more like a hope."
      },
      {
        type: "paragraph",
        text: "The delicate balance of trust on which this entire edifice was built begins to tremble, if not yet to break."
      },
      {
        type: "paragraph",
        text: "The story is not very different in developing countries either. In Pakistan, the strain is, if anything, more acute. The federal pension bill has ballooned to nearly Rs 900 billion in 2025, far exceeding the country's development expenditure, and is growing at roughly 25 percent a year, doubling every four years."
      },
      {
        type: "paragraph",
        text: "The provinces fare little better, with Punjab's pension obligations absorbing a significant portion of provincial revenue and the national railways devoting nearly 70 percent of their income to pensions."
      },
      {
        type: "paragraph",
        text: "Belatedly, Islamabad has begun to stir: the proposed Pension Fund Bill 2024 aims to replace the old pay-as-you-go model with a contributory system in which new recruits deposit a share of their salaries. But these are first tremors of reform in a system long overdue for reckoning."
      },
      {
        type: "pullquote",
        text: "There is, in short, no costless way out."
      },
      {
        type: "paragraph",
        text: "One solution lies in the so-called capitalized system, in which the contributions of today's workers are no longer paid out immediately to current retirees, but invested in financial assets that will fund their own retirement decades later."
      },
      {
        type: "paragraph",
        text: "In principle, this severs the system's dependence on demographic luck. It no longer matters whether the next generation is large or small, because each cohort, in effect, saves for itself. For a 21st century of falling birth rates and lengthening lives, the appeal is obvious."
      },
      {
        type: "paragraph",
        text: "Yet the cure carries its own complications. The most formidable is the transition itself: moving from pay-as-you-go to a capitalized system forces one unlucky generation to pay twice, once to honor the pensions of those already retired under the old promise, and once again to build the savings that will finance their own."
      },
      {
        type: "paragraph",
        text: "Whichever generation is asked to bear that double burden will quite reasonably ask why history has chosen them, and any government attempting the switch must answer that question before the first contribution is ever rerouted."
      },
      {
        type: "paragraph",
        text: "Perhaps, then, the deeper lesson is that no pension formula, however cleverly designed, can substitute for the older architecture it was built upon: the quiet web of family, neighbors, and community that once carried the old through their final years."
      },
      {
        type: "pullquote",
        text: "Aging has never been only a fiscal problem. It is, in the end, a question of who shows up."
      },
      {
        type: "paragraph",
        text: "In Pakistan, where the formal system protects only a fraction of the elderly, that informal architecture is not a relic but a lifeline, and it too is fraying under urbanization, migration, and the steady erosion of joint family life."
      },
      {
        type: "paragraph",
        text: "This is the space in which initiatives like Saathban matter. They cannot replace pensions, nor pretend to, but they remind us that in a century where the arithmetic of pay-as-you-go is failing and capitalized systems remain politically distant, the simple act of companionship may be the most honest pension of all."
      }
    ],
  },
  {
    id: "twice-as-long-and-now-what",
    title: "Twice as Long, and Now What?",
    date: "May 18, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "5 min read",
    tag: "Longevity",
    color: C.sage,
    excerpt: "We have doubled the human lifespan. The real question now is how we choose to live those extra years.",
    coverImg: "/blog_images//blog_3.png",
    content: [
      {
        type: "lead",
        text: "Queen Anne was not just the wife of a king. She was a sovereign ruler in her own right, holding full governing power over England, Scotland, and Ireland, and becoming the first monarch of the united Great Britain after the Acts of Union in 1707. She gave birth seventeen times. Not one of those children lived to see adulthood."
      },
      {
        type: "paragraph",
        text: "The luckiest, Prince William, made it to eleven before he too was gone. Some of this was personal misfortune and medical complication, but a great deal of it was simply the century she lived in. According to historical reconstructions in the Human Mortality Database (2025), life expectancy at birth in early eighteenth-century England hovered around the mid-thirties, and roughly one in four infants did not survive their first year. A queen with the best physicians of her age could not outrun the demography of her era."
      },
      {
        type: "paragraph",
        text: "Three centuries later, the picture is almost unrecognizable. According to the UN World Population Prospects 2024, global life expectancy at birth reached 73.3 years in 2024, an increase of 8.4 years since 1995."
      },
      {
        type: "paragraph",
        text: "Pull the lens back further using the historical estimates compiled by James C. Riley (2005) and Zijdeman et al. (2014), and the contrast becomes startling. As Riley's regional estimates show, the world average sat at roughly 28.5 years in 1800, climbed only to 32 by 1900, and then took off, reaching 46 by 1950 and 66 by the year 2000 in the UN data."
      },
      {
        type: "pullquote",
        text: "The average person alive today can expect to live more than twice as long as their great-great-grandparents."
      },
      {
        type: "paragraph",
        text: "The COVID-19 pandemic briefly knocked the curve back to 70.9 years in 2021, but the UN's 2024 revision notes that since 2022, life expectancy has returned to pre-COVID-19 levels in nearly all countries and areas."
      },
      {
        type: "paragraph",
        text: "Europe tells a sharper version of the same story. Drawing on Zijdeman et al. (2014) and the Human Mortality Database, a European newborn in 1800 could expect about 33 years of life. By 1900 that figure was 43, by 1950 it was 62, and by 2023 it had climbed past 79 in the UN's estimates."
      },
      {
        type: "paragraph",
        text: "According to Eurostat's preliminary release, life expectancy at birth in the EU was 81.7 years in 2024, up 0.3 years from 2023, with Spain, Italy, and Sweden now above 84 years. Queen Anne, born in 1665, would today be considered to have died young at 49."
      },
      {
        type: "paragraph",
        text: "The same person born in modern Britain would, on average, be a grandmother by then, with three decades still ahead of her. The drivers are not mysterious. Clean water, vaccines, antibiotics, safer childbirth, better nutrition, and falling infant mortality have, together, done what no single medical miracle could."
      },
      {
        type: "pullquote",
        text: "Living to one hundred may quietly stop being remarkable within two generations."
      },
      {
        type: "paragraph",
        text: "Now consider the trajectory ahead. According to the UN World Population Prospects 2024, global life expectancy is projected to rise to about 77.4 years by 2054, and Pakistan, which moved from 34 years in 1950 to roughly 68 today, is part of that quiet convergence."
      },
      {
        type: "paragraph",
        text: "If the pace of the past two centuries holds, a child born in 2050 may routinely expect to live into their late eighties, and a child born in 2100 could plausibly approach a century as the new normal."
      },
      {
        type: "paragraph",
        text: "That is not a forecast of immortality. It is what extrapolating the same public health gains, the same nutritional improvements, and the same compounding medical advances actually implies."
      },
      {
        type: "paragraph",
        text: "But longer lives are only a gift if the extra years are worth living. The world is ageing faster than it is preparing for ageing."
      },
      {
        type: "paragraph",
        text: "The UN projects that by the mid 2030s, people aged 80 and over will outnumber infants globally. Pakistan, despite its young median age, is on the same path, with the elderly share of the population set to double in the coming decades."
      },
      {
        type: "paragraph",
        text: "Yet most of the social architecture, from health systems to family structures to civic spaces, still assumes that old age is a short epilogue rather than a long chapter."
      },
      {
        type: "pullquote",
        text: "The next frontier is not just adding years to life. It is adding life, dignity, and companionship to those years."
      },
      {
        type: "paragraph",
        text: "That is the work that organizations like Saathban are trying to begin, because a society that learns to keep people alive longer must also learn how to keep them flourishing in the meantime."
      }
    ],
  },
  {
    id: "invisible-hand-population",
    title: "The Invisible Hand of Population: The Mystery of Our Ebbs and Flows",
    date: "May 12, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "5 min read",
    tag: "Research",
    color: C.brown,
    excerpt: "The greatest mystery of the demographic transition isn't found in a lab or a census bureau; it's found in the silent, invisible shift of human intentions.",
    coverImg: "/blog_images//blog_2.png",
    content: [
      {
        type: "lead",
        text: "The greatest mystery of the demographic transition isn't found in a lab or a census bureau; it's found in the silent, invisible shift of human intentions.",
      },
      {
        type: "paragraph",
        text: "Throughout history, external disasters like droughts and pandemics were the primary 'brakes' on our growth. But today, the brakes are internal. Even with vast resources and relative peace, the momentum has stalled, leaving us to wonder what invisible psychological or cultural forces are now rewriting the rules of human expansion.",
      },
      {
        type: "paragraph",
        text: "While the basic function of growth is rooted in the biology of birth and death, those numbers were always at the mercy of the environment. For centuries, the 'invisible hand' of nature used famine, drought, and disease to balance the human ledger. We understood these forces because they were visible and physical. However, as modern society has solved the problems of predators and scarcity, a new set of invisible forces has taken over. Our biological drive to multiply is now reacting to a modern environment that we are only beginning to understand.",
      },
      {
        type: "pullquote",
        text: "We are no longer limited by what the Earth can provide, but perhaps by how our own societies have evolved to prioritize the individual over the collective.",
      },
      {
        type: "paragraph",
        text: "The true mystery emerges when we realize that modern humans have largely silenced these ancient environmental alarms. We have marginalized predators, industrialized our food supply, and developed the medicine needed to curb pandemics. By all traditional logic, this removal of 'natural brakes' should have led to an era of infinite compounding. Instead, we see a voluntary retreat in growth that defies the old biological models. It appears that as we moved from a world of physical scarcity to one of social complexity, the invisible forces changed shape. ",
      },
      {
        type: "paragraph",
        text: "While the Malthusian doomsday scenario was largely avoided due to the vast growth in food production and improvement in wellbeing, the logic of compounding remains a looming shadow. If the current invisible hand did not control our growth, the power of compounding would ultimately lead us back to a Malthusian catastrophe even if we had enormous resources at hand. To put this into perspective, demographers estimate that the world population at the time of Jesus was about 250 to 300 million. For nearly two millennia, that number grew by a glacial average of roughly 0.04 to 0.08 percent annually.",
      },
      {
        type: "pullquote",
        text: "If a population of 300 million had grown at a steady rate of 0.8 percent since the year 1 AD, the world would have hit our current 8 billion mark by the year 415 AD. By today, the population would have reached a staggering 3.08 quadrillion people. These figures represent a world so crowded that there would be no room left to stand.",
      },
      {
        type: "paragraph",
        text: "The fact that we find ourselves at 8 billion today, rather than in the quadrillions, proves that an invisible hand is always at work. In the past, this hand was visible and cruel, manifest in the forms of plague and hunger. Today, it is silent and subtle. We are living through a period where the mystery of the ebb and flow has moved from the forest and the field into the human mind and the structure of our modern lives. Understanding these invisible forces is the key to understanding the future of our species.",
      },
      {
        type: "paragraph",
        text: "Even as the 'invisible hand' recalibrates our expansion toward a voluntary retreat, the victory of modern medicine has introduced a new variable: longevity. We are no longer a species defined by a rapid turnover of generations, but one characterized by an enduring, aging population. While the threat of a Malthusian explosion has faded, we now face a 'silver' transformation where the collective focus must shift from managing growth to mastering care.",
      },
      {
        type: "paragraph",
        text: "The future of our species may no longer be a race for resources to feed the many, but a profound cultural commitment to support the longevity of the individual, ensuring that the years we have gained are met with the dignity, attention, and infrastructure they require.",
      },
    ],
  },
  {
    id: "living-to-100",
    title: "Living to 100 is No Longer a Miracle",
    date: "May 05, 2026",
    author: "Hamayoon Shah | Chief Research Officer",
    readTime: "4 min read",
    tag: "Research",
    color: C.cream,
    excerpt: "The most hopeful demographic story of our time.",
    coverImg: "/blog_images//blog_1.png",
    content: [
      {
        type: "lead",
        text: "Have you ever wondered what it truly means to live for a century? A hundred years ago, reaching the age of 100 was a statistical anomaly, a feat so rare that it seemed reserved for a fortunate few. Today, however, living to 100 is no longer a miracle.",
      },
      {
        type: "paragraph",
        text: "According to the United Nations, there were only 23,000 centenarians worldwide in 1950. By 2024, that number had surged to an estimated 934,776 globally. In the span of a single lifetime, the world has witnessed a fortyfold increase in people aged 100 and older."      
      },
      {
        type: "paragraph",
        text: "This remarkable growth continues to accelerate. According to the Pew Research Center analysis of UN data, the world was home to nearly half a million centenarians in 2015, more than four times as many as in 1990. And the best is yet to come. The United Nations projects that by 2050, there will be an astounding 3.7 million centenarians worldwide. That is an eightfold increase from 2015 levels."      
      },
      {
        type: "pullquote",
        text: "From 153 to over 95,000 in just six decades, this is nothing short of extraordinary.",
      },
      {
        type: "paragraph",
        text: "One nation stands as the undisputed capital of longevity. According to data published by Japan's Ministry of Health, Labor and Welfare, Japan recorded 95,119 centenarians as of September 2024, marking the 54th consecutive annual rise. To put this in perspective, Japan had only 153 centenarians in 1963 when records began. The number surpassed 1,000 in 1981, topped 10,000 in 1998, and exceeded 90,000 in 2022.",
      },
      {
        type: "paragraph",
        text: "The United States tells a similar story. According to the U.S. Census Bureau, there were approximately 2,300 centenarians in America in 1950. By 2010, that number had grown to 53,364. And according to recent demographic projections, the United States already has about 100,000 centenarians as of 2022. Looking ahead, the U.S. Census Bureau projects that by 2060, America will be home to 590,000 people aged 100 or older. That is nearly six times the current number.",
      },
      {
        type: "paragraph",
        text: "Across every data set, one remarkable pattern holds true. According to the U.S. Census Bureau, more than 80 percent of American centenarians in 2010 were women, with only 20.7 men for every 100 women in that age group. Japan reports a similar figure, with women accounting for 88.3 percent of all centenarians in 2024. The oldest living person on Earth, as of 2024, is a 116-year-old Japanese woman named Itooka Tomiko.",
      },
      {
        type: "paragraph",
        text: "Countries worldwide are witnessing this longevity boom. According to the UN Population Division, France had only 100 centenarians in 1900 but reported 31,269 in 2024. Italy grew from 99 centenarians in 1872 to 23,548 in 2025. Thailand now has 45,561 centenarians as of 2024. Even China, despite its relatively younger population, reported 54,166 centenarians in 2013.",
      },
      {
        type: "pullquote",
        text: "One third of babies born in the UK in 2013 are expected to live to see their 100th birthday. What was once a miracle has become the new normal.",
      },
      {
        type: "paragraph",
        text: "Living to 100 was once a headline. The centenarian population is not just growing; it is exploding, and this is perhaps the most hopeful demographic story of our time.",
      },
      {
        type: "paragraph",
        text: "The arithmetic of longevity is clear, but the human work it demands is only beginning. Societies that will host millions of centenarians by 2050 must prepare now. This means investing in geriatric healthcare, designing age-friendly public spaces, supporting caregivers, and building services that address the emotional and social needs of seniors, not just the medical ones. It also means shifting how we think.",
      },
    ],
  },
];

// -- Research Reports --
// to add a new report: add an object to this array with title, year, summary, and a link.
const RESEARCH = [
  { title: "Ageing in a Young Nation",
    year: "2026",
    summary: "Our foundational secondary report examining global and Pakistan demographics with special emphasis on the elderly. Documenting ageing trends, policy landscape, and the institutional ecosystem.",
    link: "/ageing-in-a-young-nation.pdf",
    tag: "Our Report",
    tagColor: C.brown, },
  // ── Add more reports below ──
  // {
  //   title: "Report Title",
  //   year: "2026",
  //   summary: "Brief summary of the report.",
  //   link: "https://link-to-report.com",
  //   tag: "Research",
  //   tagColor: C.green,
  // },
];

const NAV_ITEMS = [
  { label: "Home", id: "home" }, { label: "About", id: "about" }, { label: "Our Work", id: "work" },
  { label: "Get Involved", id: "involve" }, { label: "Blog", id: "blog" }, { label: "Contact", id: "contact" },
];

const SOCIAL_LINKS = {
  email: "hr@saathban.com",
  instagram: "https://www.instagram.com/saathban?igsh=MWhiNzNvcGJnb21kNA==",
  facebook: "https://www.facebook.com/share/1Cgk1gCHuf/",
  linkedin: "https://www.linkedin.com/company/saathban/",
  script: "https://script.google.com/macros/s/AKfycbwhsLn3sQDn49QhtyPq5gvMj2cM4FD8e-mOColpr1zeiQN2RJK3j9fEBEh-_GRIZjmPHw/exec",
};

// ─── Blog Article Page ───
function BlogArticlePage({ blog, onBack }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${blog.title} | Saathban Blog`;
    return () => { document.title = prevTitle; };
  }, [blog]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?blog=${blog.id}`;
  const handleShare = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tagColors = { Research: C.brown, Stories: C.green, "Well-being": C.olive };
  const tc = tagColors[blog.tag] || C.green;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.textMain, background: C.white, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@0,300;0,400;0,500;0,600&display=swap');
        .article-body p { margin-bottom: 1.6em; }
      `}</style>

      {/* Back bar */}
      <div style={{ background: C.green, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, height: 64, display: "flex", alignItems: "center" }} >
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, width: "100%" }} >
          <button
            onClick={() => onBack(null)} style={{ background: "rgba(250,243,233,0.12)", border: "none", borderRadius: 40, padding: "8px 20px", color: C.cream, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "background 0.3s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,243,233,0.22)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(250,243,233,0.12)")}
          >
            ← Blog
          </button>
          <span style={{ color: "rgba(250,243,233,0.5)", fontSize: 13, flex: 1 }}>
            Saathban · Blog & Stories
          </span>
          <button
            onClick={handleShare} style={{ background: copied ? "rgba(250,243,233,0.28)" : "rgba(250,243,233,0.12)", border: "none", borderRadius: 40, padding: "8px 18px", color: C.cream, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "background 0.3s", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.background = "rgba(250,243,233,0.22)"; }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.background = "rgba(250,243,233,0.12)"; }}
          >
            {copied ? (
              <>✓ Copied</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"/></svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Article header */}
      <div style={{ position: "relative" }}>
        {blog.coverImg ? (
          // ── With cover image ──
          <div
            style={{ position: "relative", height: "clamp(280px, 45vw, 480px)", overflow: "hidden" }} >
            <img src={blog.coverImg} alt={blog.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {/* Dark gradient overlay */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)" }} />
            {/* Metadata on image */}
            <div
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 24px" }} >
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: C.white, background: tc, padding: "5px 14px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-block", marginBottom: 16 }} >
                  {blog.tag}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{ width: 36, height: 36, borderRadius: "50%", background: `${tc}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} >
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.white }} > H </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.95)" }} > {blog.author} </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }} > {blog.date} · {blog.readTime} </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ── Without cover image ──
          <div
            style={{ background: C.bg, padding: "64px 24px 48px", borderBottom: `1px solid ${C.warmGray}40` }} >
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <span
                style={{ fontSize: 11, fontWeight: 700, color: tc, background: `${tc}12`, padding: "5px 14px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-block", marginBottom: 20 }} >
                {blog.tag}
              </span>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: C.green, fontWeight: 700, lineHeight: 1.2, marginBottom: 20 }} > {blog.title} </h1>
              <p style={{ fontSize: 18, color: C.textMuted, lineHeight: 1.6, marginBottom: 28, fontStyle: "italic", fontFamily: "'Playfair Display', serif" }} > {blog.excerpt} </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{ width: 36, height: 36, borderRadius: "50%", background: `${tc}15`, display: "flex", alignItems: "center", justifyContent: "center" }} >
                  <span style={{fontSize: 14, fontWeight: 700, color: tc }} > S </span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain }} > {blog.author} </div>
                  <div style={{ fontSize: 12, color: C.textMuted }} > {blog.date} · {blog.readTime} </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Title + excerpt below image */}
        {blog.coverImg && (
          <div style={{ background: C.bg, padding: "36px 24px 32px", borderBottom: `1px solid ${C.warmGray}40` }}  >
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: C.green, fontWeight: 700, lineHeight: 1.2, marginBottom: 12 }} > {blog.title} </h1>
              <p style={{ fontSize: 18, color: C.textMuted, lineHeight: 1.6, fontStyle: "italic", fontFamily: "'Playfair Display', serif" }} > {blog.excerpt} </p>
            </div>
          </div>
        )}
      </div>

      {/* Article body */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 0" }} className="article-body">
        {blog.content.map((block, i) => {
          if (block.type === "lead") return (
            <p key={i} style={{ fontSize: "clamp(1.1rem,2vw,1.25rem)", lineHeight: 1.8, color: C.textMain, fontWeight: 500, marginBottom: "1.6em", fontFamily: "'Playfair Display', serif" }}>{block.text}</p>
          );
          if (block.type === "paragraph") return (
            <p key={i} style={{ fontSize: 17, lineHeight: 1.85, color: C.textMuted, marginBottom: "1.6em" }}>{block.text}</p>
          );
          if (block.type === "pullquote") return (
            <blockquote key={i} style={{ margin: "2.4em 0", padding: "24px 32px", borderLeft: `4px solid ${tc}`, background: `${tc}06`, borderRadius: "0 12px 12px 0" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.05rem,2vw,1.2rem)", fontStyle: "italic", color: tc, lineHeight: 1.7, margin: 0 }}>{block.text}</p>
            </blockquote>
          );
          if (block.type === "numbered") return (
            <div key={i} style={{ margin: "2em 0" }}>
              {block.items.map((item, j) => (
                <div key={j} style={{ display: "flex", gap: 20, marginBottom: 28, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: tc, color: C.cream, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 2 }}>{j + 1}</div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: C.green, marginBottom: 6 }}>{item.title}</p>
                    <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, margin: 0 }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          );
          return null;
        })}
      </div>

      {/* Watermark footer */}
      <div style={{ maxWidth: 760, margin: "48px auto 0", padding: "24px 24px 48px", borderTop: `1px solid ${C.warmGray}50`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-small.png" alt="Saathban" style={{ height: 32, width: "auto", opacity: 0.7 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Saathban — Timeless Togetherness</div>
            <div style={{ fontSize: 11, color: C.warmGray }}>saathban.com</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: C.warmGray, fontStyle: "italic" }}>Where generations flourish together</span>
      </div>

      {/* More articles */}
      <div style={{ background: C.bg, padding: "48px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.green, marginBottom: 24 }}>More from Saathban</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {BLOGS.filter(b => b.id !== blog.id).slice(0, 3).map(b => (
              <div key={b.id} onClick={() => { window.scrollTo(0, 0); onBack(b); }}
                style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer", padding: "16px", borderRadius: 12, background: C.white, boxShadow: "0 1px 8px rgba(6,50,20,0.05)", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(6,50,20,0.1)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 8px rgba(6,50,20,0.05)"}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: `${tagColors[b.tag] || C.green}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: tagColors[b.tag] || C.green }}>{b.tag[0]}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tagColors[b.tag] || C.green, textTransform: "uppercase", letterSpacing: "0.06em" }}>{b.tag} · {b.readTime}</span>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.green, margin: "4px 0 2px", lineHeight: 1.35 }}>{b.title}</p>
                  <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>{b.date}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button onClick={() => onBack(null)} style={{ background: "transparent", border: `2px solid ${C.green}`, borderRadius: 40, padding: "10px 28px", color: C.green, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>← All Articles</button>
          </div>
        </div>
      </div>

      <div style={{ background: C.green, padding: "24px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(250,243,233,0.5)" }}>© 2026 Saathban — Timeless Togetherness · saathban.com</span>
      </div>
    </div>
  );
}

// ─── Carousel Component ───
function Carousel({ items, renderCard, perPage = 3 }) {
  const [idx, setIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const pp = isMobile ? 1 : perPage;
  const total = Math.ceil(items.length / pp);
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(total - 1, i + 1));
  const visible = items.slice(idx * pp, idx * pp + pp);

  if (items.length <= pp) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${pp}, 1fr)`, gap: 28 }}>
        {items.map((item, i) => renderCard(item, i))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${pp}, 1fr)`, gap: 28, minHeight: 280 }}>
        {visible.map((item, i) => renderCard(item, i))}
      </div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 32 }}>
        <button onClick={prev} disabled={idx === 0}
          style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${idx === 0 ? C.warmGray : C.green}`, background: "transparent", cursor: idx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", color: idx === 0 ? C.warmGray : C.green, fontSize: 18, fontWeight: 700 }}>
          ←
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} onClick={() => setIdx(i)}
              style={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, background: i === idx ? C.green : C.warmGray, cursor: "pointer", transition: "all 0.3s ease" }} />
          ))}
        </div>
        <button onClick={next} disabled={idx === total - 1}
          style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${idx === total - 1 ? C.warmGray : C.green}`, background: "transparent", cursor: idx === total - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", color: idx === total - 1 ? C.warmGray : C.green, fontSize: 18, fontWeight: 700 }}>
          →
        </button>
      </div>
    </div>
  );
}

// ─── Fade-In Observer ───
function FadeIn({ children, className = "", delay = 0, style: extra = {} }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.7s cubic-bezier(.4,0,.2,1) ${delay}s`, ...extra,
    }}>{children}</div>
  );
}

// ─── Section Title ───
function SecTitle({ children, sub, light }) {
  return (
    <div style={{ marginBottom: 52, textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.9rem,4vw,2.8rem)", color: light ? C.cream : C.green, margin: 0, fontWeight: 700, letterSpacing: "-0.01em" }}>{children}</h2>
      {sub && <p style={{ fontSize: 16, color: light ? "rgba(250,243,233,0.75)" : C.textMuted, marginTop: 14, maxWidth: 540, marginInline: "auto", lineHeight: 1.65 }}>{sub}</p>}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.brown }} />
        <div style={{ width: 12, height: 3, borderRadius: 2, background: C.green }} />
        <div style={{ width: 6, height: 3, borderRadius: 2, background: C.sage }} />
      </div>
    </div>
  );
}

// ─── Button ───
function Btn({ children, onClick, variant = "primary", style: s = {}, href }) {
  const base = { fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, border: "none", borderRadius: 50, cursor: "pointer", padding: "14px 36px", letterSpacing: "0.02em", transition: "all 0.35s ease", display: "inline-block", textDecoration: "none" };
  const styles = variant === "primary"
    ? { ...base, background: C.green, color: C.cream, boxShadow: "0 4px 24px rgba(6,50,20,0.25)", ...s }
    : variant === "brown"
      ? { ...base, background: C.brown, color: C.cream, boxShadow: "0 4px 24px rgba(87,52,37,0.25)", ...s }
      : { ...base, background: "transparent", color: C.green, border: `2px solid ${C.green}`, ...s };
  const Tag = href ? "a" : "button";
  return <Tag style={styles} onClick={onClick} href={href} target={href ? "_blank" : undefined} rel={href ? "noopener noreferrer" : undefined}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.03)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>{children}</Tag>;
}

// ─── Card ───
function Card({ children, style: s = {}, hover = true, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)", transition: "all 0.35s ease", cursor: onClick ? "pointer" : "default", ...s }}
      onMouseEnter={hover ? e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 36px rgba(6,50,20,0.1)"; } : undefined}
      onMouseLeave={hover ? e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 20px rgba(6,50,20,0.06)"; } : undefined}
    >{children}</div>
  );
}

// ─── Stat Counter ───
function Stat({ number, label, delay = 0 }) {
  return (
    <FadeIn delay={delay} style={{ textAlign: "center", flex: "1 1 140px" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: C.brown }}>{number}</div>
      <div style={{ fontSize: 14, color: C.textMuted, marginTop: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </FadeIn>
  );
}

// ─── Image Carousel ───
const CAROUSEL_IMAGES = [
  { src: "/saathbanimage2.jpg", caption: "Building bridges between generations", label: "Community" },
  { src: "/saathbanimage.jpg", caption: "Every elder deserves to be seen and heard", label: "Connection" },
  { src: "/saathbanimage3.jpg", caption: "Wisdom shared is wisdom multiplied", label: "Togetherness" },
];

function ImageCarousel() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const timerRef = useRef(null);

  const go = useCallback((next, dir = 1) => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(next);
      setAnimating(false);
    }, 420);
  }, [animating]);

  const prev = () => {
    const next = (current - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length;
    go(next, -1);
  };

  const next = useCallback(() => {
    const n = (current + 1) % CAROUSEL_IMAGES.length;
    go(n, 1);
  }, [current, go]);

  useEffect(() => {
    timerRef.current = setInterval(() => { next(); }, 5000);
    return () => clearInterval(timerRef.current);
  }, [next]);

  const img = CAROUSEL_IMAGES[current];

  // Inject <link rel="preload"> for all images at the highest browser fetch priority
  useEffect(() => {
    CAROUSEL_IMAGES.forEach(({ src }) => {
      if (document.querySelector(`link[rel="preload"][href="${src}"]`)) return;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.fetchPriority = "high";
      link.href = src;
      document.head.appendChild(link);
    });
  }, []);

  return (
    <section style={{ padding: "32px 0", background: C.bg }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px" }}>
        <FadeIn>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(6,50,20,0.10)" }}>
            <div style={{ position: "relative", height: "clamp(220px, 36vw, 480px)", overflow: "hidden", background: C.dark }}>
              <img
                key={current}
                src={img.src}
                alt={img.caption}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "cover",
                  objectPosition: "center",
                  opacity: animating ? 0 : 1,
                  transform: animating
                    ? `translateX(${direction * 24}px) scale(0.98)`
                    : "translateX(0) scale(1)",
                  transition: "opacity 0.38s cubic-bezier(.4,0,.2,1), transform 0.38s cubic-bezier(.4,0,.2,1)",
                }}
              />
              {/* Gradient overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(6,18,10,0.60) 0%, rgba(6,18,10,0.05) 55%, transparent 100%)",
                pointerEvents: "none",
              }} />

              {/* Bottom bar: caption left, dots right */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "20px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                opacity: animating ? 0 : 1,
                transform: animating ? "translateY(6px)" : "translateY(0)",
                transition: "opacity 0.38s ease 0.06s, transform 0.38s ease 0.06s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: C.cream, background: `${C.brown}bb`, backdropFilter: "blur(6px)",
                    padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                  }}>{img.label}</span>
                  <p style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(0.8rem, 1.4vw, 1rem)",
                    fontStyle: "italic",
                    color: "rgba(250,243,233,0.88)",
                    margin: 0, lineHeight: 1.4,
                    textShadow: "0 1px 6px rgba(0,0,0,0.4)",
                  }}>{img.caption}</p>
                </div>
                {/* Dots */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {CAROUSEL_IMAGES.map((_, i) => (
                    <div key={i} onClick={() => go(i, i > current ? 1 : -1)} style={{
                      width: i === current ? 22 : 6, height: 6, borderRadius: 3,
                      background: i === current ? C.cream : "rgba(250,243,233,0.3)",
                      cursor: "pointer", transition: "all 0.3s ease",
                    }} />
                  ))}
                </div>
              </div>

              {/* Arrows */}
              {[{ label: "←", action: prev, side: { left: 14 } }, { label: "→", action: next, side: { right: 14 } }].map(({ label, action, side }) => (
                <button key={label} onClick={action} style={{
                  position: "absolute", top: "50%", transform: "translateY(-50%)", ...side,
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: "rgba(250,243,233,0.14)", backdropFilter: "blur(8px)",
                  color: C.cream, fontSize: 16, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s", zIndex: 10,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(250,243,233,0.28)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(250,243,233,0.14)"}
                >{label}</button>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Hero Illustration: Elderly people───
function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 440" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380, height: "auto" }}>
      {/* Background circles */}
      <circle cx="200" cy="220" r="190" fill={C.green} opacity="0.06" />
      <circle cx="200" cy="220" r="140" fill={C.brown} opacity="0.06" />

      {/* Ground */}
      <ellipse cx="200" cy="400" rx="160" ry="16" fill={C.green} opacity="0.08" />

      {/* Floating leaves */}
      <path d="M80 120 Q90 110, 100 120 Q90 130, 80 120Z" fill={C.green} opacity="0.2" transform="rotate(-30 90 120)" />
      <path d="M300 100 Q310 90, 320 100 Q310 110, 300 100Z" fill={C.sage} opacity="0.2" transform="rotate(20 310 100)" />
      <path d="M60 300 Q70 290, 80 300 Q70 310, 60 300Z" fill={C.green} opacity="0.15" transform="rotate(-15 70 300)" />

      {/* Small birds */}
      <path d="M100 80 Q105 70 110 78 Q115 70 120 80" stroke={C.green} strokeWidth="1.5" fill="none" opacity="0.2" />
      <path d="M280 60 Q285 50 290 58 Q295 50 300 60" stroke={C.green} strokeWidth="1.5" fill="none" opacity="0.15" />

      {/* Logo image centered on top of the background */}
      <image
        href="/hero.png"
        x="15"
        y="58"
        width="380"
        height="380"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}

// ─── Event Detail Page ───
function EventDetailPage({ event, onBack }) {
  const d = event.detail;
  const px = { maxWidth: 900, margin: "0 auto", padding: "0 24px" };
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${event.title} | Saathban Events`;
    return () => { document.title = prevTitle; };
  }, [event]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?event=${event.id}`;
  const handleShare = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.textMain, background: C.bg, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@0,300;0,400;0,500;0,600;0,700&display=swap');
        @media(max-width:640px) {
          .event-detail-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>

      {/* Back bar */}
      <div style={{ background: C.green, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(250,243,233,0.12)", border: "none", borderRadius: 40, padding: "8px 20px", color: C.cream, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.3s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(250,243,233,0.22)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(250,243,233,0.12)"}>
            ← Back to Events
          </button>
          <span style={{ color: "rgba(250,243,233,0.5)", fontSize: 13, flex: 1 }}>Saathban Events</span>
          <button
            onClick={handleShare} style={{ background: copied ? "rgba(250,243,233,0.28)" : "rgba(250,243,233,0.12)", border: "none", borderRadius: 40, padding: "8px 18px", color: C.cream, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "background 0.3s", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.background = "rgba(250,243,233,0.22)"; }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.background = "rgba(250,243,233,0.12)"; }}
          >
            {copied ? (
              <>✓ Copied</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"/></svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hero banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, padding: "64px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(250,243,233,0.08)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: `${C.brown}15` }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
          <span style={{ display: "inline-block", background: `${C.brown}`, borderRadius: 40, padding: "6px 18px", marginBottom: 20, fontSize: 12, fontWeight: 700, color: C.cream, letterSpacing: "0.08em", textTransform: "uppercase" }}>Past Event</span>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,3rem)", color: C.cream, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>{event.title}</h1>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginTop: 20 }}>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              📅 {d.fullDate}
            </span>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🕒 {d.time}
            </span>
            <span style={{ color: "rgba(250,243,233,0.8)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              📍 {d.venue}
            </span>
          </div>
        </div>
      </div>

      <div style={{ ...px, padding: "60px 24px" }}>

        {/* About the event */}
        <FadeIn>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 20 }}>About the Event</h2>
            {d.about.split("\n\n").map((para, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.85, color: C.textMuted, marginBottom: 16 }}>{para}</p>
            ))}
          </div>
        </FadeIn>

        {/* Highlights + Agenda */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 56 }} className="event-detail-grid">
          <FadeIn delay={0.1}>
            <div style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.green, marginBottom: 20 }}>Event Highlights</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {d.highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${C.brown}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.brown }} />
                    </div>
                    <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div style={{ background: C.white, borderRadius: 16, padding: 32, boxShadow: "0 2px 20px rgba(6,50,20,0.06)" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.green, marginBottom: 20 }}>Event Agenda</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {d.agenda.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", paddingBottom: i < d.agenda.length - 1 ? 16 : 0, borderBottom: i < d.agenda.length - 1 ? `1px solid ${C.warmGray}50` : "none", marginBottom: i < d.agenda.length - 1 ? 16 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.brown, whiteSpace: "nowrap", paddingTop: 2, minWidth: 54 }}>{a.time}</span>
                    <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>{a.item}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Photo gallery (placeholder) */}
        <FadeIn delay={0.2}>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 8 }}>Gallery</h2>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, fontStyle: "italic" }}>Photos from the event.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {d.gallery.map((g, i) => (
                <div key={i} style={{ background: `linear-gradient(135deg, ${C.green}10, ${C.brown}06)`, borderRadius: 14, aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: `1px dashed ${C.warmGray}` }}>
                  <span style={{ fontSize: 36 }}>{g.emoji}</span>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{g.label}</span>
                  <span style={{ fontSize: 11, color: C.warmGray, fontStyle: "italic" }}>Add photo</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Quote */}
        <FadeIn delay={0.25}>
          <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "44px 48px", textAlign: "center", border: `1px solid ${C.warmGray}50`, marginBottom: 56 }}>
            <div style={{ fontSize: 48, color: C.brown, opacity: 0.2, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 8 }}>"</div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.1rem,2.5vw,1.4rem)", fontStyle: "italic", color: C.green, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 16px" }}>
              {d.quote.text}
            </p>
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>— {d.quote.author}</span>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.3}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, color: C.textMuted, marginBottom: 20 }}>Want to be part of our next event?</p>
            <Btn onClick={onBack}>← See All Events</Btn>
          </div>
        </FadeIn>
      </div>

      {/* Footer strip */}
      <div style={{ background: C.green, padding: "24px", textAlign: "center", marginTop: 40 }}>
        <span style={{ fontSize: 13, color: "rgba(250,243,233,0.5)" }}>© 2026 Saathban — Timeless Togetherness</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN APP
   ════════════════════════════════ */
export default function Saathban() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", message: "", contactType: "General" });
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(false);
  const [sent, setSent] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [emailError, setEmailError] = useState("");
  const [subEmailError, setSubEmailError] = useState("");

  // ─── URL-based routing for blog & event detail pages ───
  // Reads ?blog=<id> or ?event=<id> from the URL so each post/event has a shareable link.
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search));

  useEffect(() => {
    const onPop = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const blogId = params.get("blog");
  const eventId = params.get("event");
  const activeBlog = blogId ? BLOGS.find(b => b.id === blogId) || null : null;
  const activeEvent = eventId ? EVENTS.find(e => e.id === eventId) || null : null;

  const goToBlog = useCallback((id) => {
    const url = `${window.location.pathname}?blog=${id}`;
    window.history.pushState({}, "", url);
    setParams(new URLSearchParams(window.location.search));
  }, []);

  const goToEvent = useCallback((id) => {
    const url = `${window.location.pathname}?event=${id}`;
    window.history.pushState({}, "", url);
    setParams(new URLSearchParams(window.location.search));
  }, []);

  const closeDetail = useCallback((anchorId) => {
    window.history.pushState({}, "", window.location.pathname);
    setParams(new URLSearchParams());
    setTimeout(() => document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const scrollTo = useCallback((id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

// Blog article page
  if (activeBlog) {
    return <BlogArticlePage blog={activeBlog} onBack={(nextBlog) => {
      if (nextBlog) { goToBlog(nextBlog.id); }
      else { closeDetail("blog"); }
    }} />;
  }

  // Event detail page
  if (activeEvent) {
    return <EventDetailPage event={activeEvent} onBack={() => closeDetail("work")} />;
  }
   
  const px = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };

  const SocialIcon = ({ href, icon, bg }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ width: 40, height: 40, borderRadius: 10, background: bg || "rgba(250,243,233,0.08)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s", flexShrink: 0 }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(250,243,233,0.22)"}
      onMouseLeave={e => e.currentTarget.style.background = bg || "rgba(250,243,233,0.08)"}>
      {icon}
    </a>
  );

  const ABOUT_TABS = [
    { key: "about", label: "Who We Are" },
    { key: "founders", label: "Our Founders" },
    { key: "mission", label: "Our Mission" },
    { key: "vision", label: "Our Vision" },
    { key: "team", label: "Our Team" },
  ];

  const tagColors = { Research: C.brown, Stories: C.green, "Well-being": C.olive };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.textMain, background: C.bg, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${C.bg}; }
        ::selection { background: ${C.green}; color: ${C.cream}; }
        input:focus, textarea:focus { outline: 2px solid ${C.green}; outline-offset: 2px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media(max-width:900px) { .grid3, .grid4 { grid-template-columns: repeat(2, 1fr); } }
        @media(max-width:640px) { .grid2, .grid3, .grid4 { grid-template-columns: 1fr; } .hide-mobile { display: none !important; } .show-mobile { display: flex !important; } .hero-text { font-size: 2.4rem !important; } .section-pad { padding: 72px 0 !important; } .hero-flex { flex-direction: column; } }
        @media(min-width:641px) { .show-mobile { display: none !important; } }
        @media(max-width:640px) { .mission-grid { grid-template-columns: 1fr !important; gap: 28px !important; } .event-detail-grid { grid-template-columns: 1fr !important; gap: 20px !important; } }
        a { color: ${C.green}; text-decoration: none; }
        a:hover { color: ${C.greenLight}; }
      `}</style>

      {/* ────── Hidden SEO ────── */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }} aria-hidden="true">
        <h1>Saathban — Timeless Togetherness | Combating Elderly Loneliness in Senior Living Communities</h1>
        <p>Saathban is a vibrant ecosystem where generations flourish together. We work with old age homes, senior living communities, and senior community housing to improve elderly health, mental health, and well-being. Keywords: old age homes, senior living, senior citizens, senior community housing, senior living communities, aged care, social security, community, socialise, lonely, loneliness, well-being, elderly health, mental health, Saath-Icons, Saath-Buddies.</p>
      </div>

      {/* ═══════════ NAVIGATION ═══════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(250,243,233,0.93)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.green}15` : "none",
        transition: "all 0.4s ease", padding: scrolled ? "8px 0" : "14px 0",
      }}>
        <div style={{ ...px, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} onClick={() => scrollTo("home")}>
            <img src="/logo-small.png" alt="Saathban" style={{ height: 40, width: "auto" }} />
          </div>

          {/* Desktop links */}
          <div className="hide-mobile" style={{ display: "flex", gap: 28, alignItems: "center" }}>
            {NAV_ITEMS.filter(n => n.id !== "involve").map(n => (
              <span key={n.id} onClick={() => scrollTo(n.id)} style={{
                cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: C.brown, letterSpacing: "0.05em",
                textTransform: "uppercase", transition: "color 0.3s", padding: "4px 0",
              }} onMouseEnter={e => e.target.style.color = C.green} onMouseLeave={e => e.target.style.color = C.brown}>{n.label}</span>
            ))}
            <Btn variant="primary" onClick={() => scrollTo("involve")} style={{ padding: "10px 24px", fontSize: 13 }}>Get Involved</Btn>
          </div>

          {/* Mobile hamburger */}
          <div className="show-mobile" style={{ display: "none", cursor: "pointer", flexDirection: "column", gap: 5, padding: 8 }} onClick={() => setMenuOpen(!menuOpen)}>
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", opacity: menuOpen ? 0 : 1 }} />
            <div style={{ width: 24, height: 2.5, background: C.green, borderRadius: 2, transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: C.cream, borderTop: `1px solid ${C.warmGray}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {NAV_ITEMS.map(n => (
              <span key={n.id} onClick={() => scrollTo(n.id)} style={{ fontSize: 16, fontWeight: 600, color: C.green, cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.warmGray}` }}>{n.label}</span>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section id="home" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        {/* Background decoration */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "55vw", height: "55vw", maxWidth: 700, maxHeight: 700, borderRadius: "50%", background: `radial-gradient(circle, ${C.green}08, transparent 70%)` }} />
          <div style={{ position: "absolute", bottom: "5%", left: "-8%", width: "40vw", height: "40vw", maxWidth: 500, maxHeight: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.brown}08, transparent 70%)` }} />
          <div className="hide-mobile" style={{ position: "absolute", top: "20%", left: "65%", width: 160, height: 160, borderRadius: "50%", border: `2px solid ${C.green}12`, animation: "float 6s ease-in-out infinite" }} />
          {/* Leaf pattern */}
          <svg style={{ position: "absolute", top: "15%", left: "5%", opacity: 0.05 }} width="120" height="120">
            {[0, 1, 2, 3].map(i => <path key={i} d={`M${30 + i * 25} 60 Q${40 + i * 25} ${40 - i * 5}, ${50 + i * 25} 60 Q${40 + i * 25} ${80 + i * 5}, ${30 + i * 25} 60Z`} fill={C.green} transform={`rotate(${i * 30} ${40 + i * 25} 60)`} />)}
          </svg>
        </div>

        <div style={{ ...px, position: "relative", zIndex: 1, width: "100%", paddingTop: 100, paddingBottom: 60 }}>
          <div className="hero-flex" style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* Left: Text */}
            <div style={{ flex: "1 1 480px", maxWidth: 580 }}>
              <div style={{ display: "inline-block", background: `${C.green}10`, borderRadius: 40, padding: "8px 20px", marginBottom: 24 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.green, letterSpacing: "0.08em", textTransform: "uppercase" }}>Where Generations Flourish Together</span>
              </div>
              <h1 className="hero-text" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.6rem,5.5vw,4.2rem)", color: C.green, lineHeight: 1.12, fontWeight: 700, marginBottom: 10 }}>
                Timeless{" "}
                <span style={{ position: "relative", display: "inline-block" }}>
                  <span style={{ position: "relative", zIndex: 1 }}>Togetherness</span>
                  <span style={{ position: "absolute", bottom: 4, left: -4, right: -4, height: 14, background: `${C.brown}20`, borderRadius: 4, zIndex: 0 }} />
                </span>
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.7, color: C.textMuted, marginTop: 20, maxWidth: 520 }}>
                Saathban is a vibrant ecosystem where generations flourish together. We are cultivating a space where wisdom is inherited, life is shared, and every age thrives as one unified, timeless community.
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 36, flexWrap: "wrap" }}>
                <Btn onClick={() => scrollTo("work")}>Explore Our Work</Btn>
                <Btn variant="outline" onClick={() => scrollTo("involve")}>Join the Movement</Btn>
              </div>
            </div>

            {/* Right: Illustration */}
            <div className="hide-mobile" style={{ flex: "1 1 340px", display: "flex", justifyContent: "center" }}>
              <HeroIllustration />
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", gap: 40, marginTop: 56, flexWrap: "wrap", padding: "32px 0", borderTop: `1px solid ${C.warmGray}` }}>
            <Stat number="500+" label="Seniors Reached" delay={0.1} />
            <Stat number="50+" label="Volunteers" delay={0.2} />
            <Stat number="12+" label="Events Held" delay={0.3} />
            {/* <Stat number="3" label="Reports" delay={0.4} /> //add whenever a good amount is reached*/}
          </div>
        </div>
      </section>

     {/* ═══════════ IMAGE CAROUSEL ═══════════ */}
      <ImageCarousel />
       {/* ═══════════ ABOUT ═══════════ */}
      <section id="about" className="section-pad" style={{ padding: "100px 0", background: C.white }}>
        <div style={px}>
          <SecTitle sub="The Heart of Togetherness">About Saathban</SecTitle>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 44, flexWrap: "wrap" }}>
            {ABOUT_TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "10px 28px", borderRadius: 40, border: "none", cursor: "pointer",
                background: activeTab === t.key ? C.green : `${C.warmGray}60`,
                color: activeTab === t.key ? C.cream : C.brown, transition: "all 0.3s ease",
              }}>{t.label}</button>
            ))}
          </div>

          {/* About — Who We Are */}
          {activeTab === "about" && (
            <FadeIn>
              <div style={{ maxWidth: 860, margin: "0 auto" }}>
                <div style={{ marginBottom: 48 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.green}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🌿</span></span>
                    The Gap We Bridge
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>For too long, society has moved in separate circles. We've placed our experience on the sidelines and our energy at the core. At Saathban, we believe that a community is only as strong as its connections. We are the bridge between the keepers of our legacy and the leaders of our future.</p>
                </div>
                <div style={{ marginBottom: 48 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.brown}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🤝</span></span>
                    Beyond Care, Toward Contribution
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>We are a platform that celebrates age as it tends to bring about contentment, wisdom and peace. By creating a space for <strong style={{ color: C.green }}>Saath-Icons</strong> (our elders) and <strong style={{ color: C.brown }}>Saath-Buddies</strong> (our youth) to interact, we transform quiet moments into shared milestones.</p>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "36px 40px", border: `1px solid ${C.warmGray}50` }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.sage}20`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 18 }}>🌳</span></span>
                    A Timeless Society
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted, paddingLeft: 48 }}>Inspired by the strength of a rooted tree and the warmth of a rising sun, Saathban is building a seamless reality where age is a badge of honor, and togetherness is our natural state.</p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Founders */}
          {activeTab === "founders" && (
            <FadeIn>
              <div style={{ maxWidth: 960, margin: "0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36 }} className="mission-grid">
                  {FOUNDERS.map((f, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(6,50,20,0.06)", border: `1px solid ${C.warmGray}50` }}>
                      {/* Photo */}
                      <div style={{ paddingTop: 32, display: "flex", justifyContent: "center", background: `linear-gradient(135deg, ${C.green}12, ${C.brown}08)`, }}>
                        <div style={{ width: 180, height: 180, borderRadius: "50%", overflow: "hidden", border: `3px solid ${i === 0 ? C.green : C.brown}25`, background: i === 0 ? `${C.green}10` : `${C.brown}10`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", }}>
                          <img
                            src={f.img}
                            alt={f.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "grayscale(100%)", display: "block", }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, }}>
                            <span
                              style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: i === 0 ? C.green : C.brown, }}>
                              {f.name.split(" ").map((w) => w[0]).join("")}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      <div style={{ padding: 32 }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 4 }}>{f.name}</h3>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.green : C.brown, background: i === 0 ? `${C.green}10` : `${C.brown}10`, padding: "4px 14px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-block", marginBottom: 16 }}>{f.role}</span>
                        <p style={{ fontSize: 15, lineHeight: 1.75, color: C.textMuted, marginBottom: 20 }}>{f.bio}</p>
                        {/* Message */}
                        <div style={{ background: i === 0 ? `${C.green}06` : `${C.brown}06`, borderLeft: `3px solid ${i === 0 ? C.green : C.brown}`, borderRadius: "0 12px 12px 0", padding: "16px 20px" }}>
                          <div style={{ fontSize: 28, color: i === 0 ? C.green : C.brown, opacity: 0.25, fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 6 }}>"</div>
                          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontStyle: "italic", color: i === 0 ? C.green : C.brown, lineHeight: 1.7 }}>{f.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Mission */}
          {activeTab === "mission" && (
            <FadeIn>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="mission-grid">
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 18 }}>Our Mission</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: C.textMuted }}>We are working toward dismantling the barriers of age by facilitating purposeful interactions between generations. By creating structured opportunities for mentorship and shared experiences, we ensure that every individual remains an active contributor to the social, emotional, and cultural wealth of our society.</p>
                </div>
                <div style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: 40, display: "flex", flexDirection: "column", gap: 20, border: `1px solid ${C.warmGray}50` }}>
                  {["Dismantle barriers of age through purposeful interaction", "Facilitate mentorship between Saath-Icons & Saath-Buddies", "Create structured opportunities for shared experiences", "Ensure every individual contributes to our collective wealth"].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${[C.green,C.brown,C.sage,C.olive][i]}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: [C.green,C.brown,C.sage,C.olive][i] }} />
                      </div>
                      <span style={{ fontSize: 15, color: C.textMain, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Vision */}
          {activeTab === "vision" && (
            <FadeIn>
              <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 60, marginBottom: 20, opacity: 0.15 }}>✦</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: C.green, marginBottom: 20 }}>Our Vision</h3>
                <p style={{ fontSize: 18, lineHeight: 1.8, color: C.textMuted, marginBottom: 24 }}>To redefine aging as a period of renewed status and social vitality. We imagine a future where the artificial divide between young and old is gone, replaced by a seamless society that treasures experience as much as energy and views togetherness as our greatest strength.</p>
                <div style={{ background: `linear-gradient(135deg, ${C.green}10, ${C.sage}15)`, borderRadius: 16, padding: "28px 36px", display: "inline-block", marginTop: 12 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontStyle: "italic", color: C.green, lineHeight: 1.6 }}>"Age is a badge of honor, and togetherness is our natural state."</p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Team */}
          {activeTab === "team" && (
            <FadeIn>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" }}>
                {TEAM.map((m, i) => (
                  <Card key={i} style={{ textAlign: "center", padding: 28 }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 16px", overflow: "hidden", border: `2px solid ${m.color}25`, background: `${m.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {m.img ? (
                        <img src={m.img} alt={m.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "grayscale(100%)" }}
                          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                      ) : null}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: m.color, display: m.img ? "none" : "block" }}>{m.initials}</span>
                    </div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 4 }}>{m.name}</h4>
                    <p style={{ fontSize: 13, color: C.brown, fontWeight: 600, letterSpacing: "0.02em" }}>{m.role}</p>
                  </Card>
                ))}
              </div>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ═══════════ OUR WORK ═══════════ */}
      <section id="work" className="section-pad" style={{ padding: "100px 0", background: C.bg }}>
        <div style={px}>
          <SecTitle sub="From grassroots events to research — here's how we make a difference.">Our Work</SecTitle>

          {/* Reports Carousel */}
          <FadeIn>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${C.green}10`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </span>
              Research & Reports
            </h3>
            <div style={{ marginBottom: 56 }}>
              <Carousel items={RESEARCH} perPage={2} renderCard={(r, i) => (
                <Card key={i} style={{ borderLeft: `4px solid ${r.tagColor}`, height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: C.green, flex: 1, lineHeight: 1.4 }}>{r.title}</h4>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.tagColor, background: `${r.tagColor}10`, padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap", marginLeft: 12 }}>{r.year}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.tagColor, background: `${r.tagColor}10`, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em", display: "inline-block", marginBottom: 10 }}>{r.tag}</span>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 16 }}>{r.summary}</p>
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: r.tagColor, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>View Report →</a>
                  ) : (
                    <span style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>Full report coming soon</span>
                  )}
                </Card>
              )} />
            </div>
          </FadeIn>

          {/* Events Carousel */}
          <FadeIn delay={0.1}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${C.brown}10`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.brown} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              Events
            </h3>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, marginLeft: 48 }}>Click on a past event to view photos, highlights, and full details.</p>
            <Carousel items={EVENTS} perPage={3} renderCard={(ev, i) => (
              <Card key={i} style={{ overflow: "hidden", position: "relative", height: "100%" }}
                onClick={ev.detail ? () => goToEvent(ev.id) : undefined}>
                <div style={{ height: 6, background: ev.color, margin: "-32px -32px 20px -32px", borderRadius: "16px 16px 0 0" }} />
                <span style={{ position: "absolute", top: 22, right: 20, fontSize: 11, fontWeight: 700, color: ev.detail ? C.brown : C.green, background: ev.detail ? `${C.brown}12` : `${C.green}10`, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {ev.detail ? "Past" : "Upcoming"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: ev.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{ev.date}</span>
                <h4 style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "8px 0", lineHeight: 1.35 }}>{ev.title}</h4>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {ev.loc}
                </p>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: ev.detail ? 16 : 0 }}>{ev.desc}</p>
                {ev.detail && <span style={{ fontSize: 13, fontWeight: 600, color: C.brown, display: "inline-flex", alignItems: "center", gap: 6 }}>View Event Details →</span>}
              </Card>
            )} />
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ GET INVOLVED ═══════════ */}
      <section id="involve" style={{ padding: "100px 0", background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", border: "1px solid rgba(250,243,233,0.08)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -50, width: 250, height: 250, borderRadius: "50%", background: `${C.brown}10` }} />
        <div style={{ ...px, position: "relative", zIndex: 1 }}>
          <SecTitle light sub="Whether you give your time or your platform — every contribution counts.">Get Involved</SecTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, maxWidth: 860, margin: "0 auto" }} className="mission-grid">
            <FadeIn delay={0.1}>
              <div style={{ background: "rgba(250,243,233,0.08)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 40, border: "1px solid rgba(250,243,233,0.12)", height: "100%" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.cream}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.cream, marginBottom: 14 }}>Become a Saath-Buddy</h3>
                <p style={{ fontSize: 15, color: "rgba(250,243,233,0.72)", lineHeight: 1.7, marginBottom: 24 }}>Spend time with Saath-Icons, help organise events, or contribute your skills remotely. Volunteering with Saathban means making a direct impact on elderly well-being in your community.</p>
                <Btn variant="brown" onClick={() => { setContact(c => ({ ...c, contactType: "Volunteer", message: "Hi, I'm interested in volunteering with Saathban." })); scrollTo("contact"); }}>Volunteer Now →</Btn>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div style={{ background: "rgba(250,243,233,0.08)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 40, border: "1px solid rgba(250,243,233,0.12)", height: "100%" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.cream}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.cream, marginBottom: 14 }}>Partner With Us</h3>
                <p style={{ fontSize: 15, color: "rgba(250,243,233,0.72)", lineHeight: 1.7, marginBottom: 24 }}>Are you an organisation, old age home, or senior living community? Let's collaborate to create intergenerational programmes, co-host events, or support our research.</p>
                <Btn variant="brown" onClick={() => { setContact(c => ({ ...c, contactType: "Partner", message: "Hi, I'd like to explore partnering with Saathban." })); scrollTo("contact"); }}>Partner With Us →</Btn>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ BLOG / STORIES ═══════════ */}
      <section id="blog" className="section-pad" style={{ padding: "100px 0", background: C.white }}>
        <div style={px}>
          <SecTitle sub="Stories, insights, and reflections on intergenerational connection and well-being.">Blog & Stories</SecTitle>
          <Carousel items={BLOGS} perPage={3} renderCard={(b, i) => {
            const tc = tagColors[b.tag] || C.green;
            return (
              <Card key={i} style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => goToBlog(b.id)}>
                {/* Cover image area — with or without photo */}
                <div style={{ height: 180, position: "relative", overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${tc}15, ${tc}05)` }}>
                  {b.coverImg ? (
                    <img src={b.coverImg} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: `${tc}20`, fontWeight: 700 }}>{b.tag[0]}</span>
                    </div>
                  )}
                  {/* Tag pill — top left */}
                  <span style={{ position: "absolute", bottom: 14, left: 14, fontSize: 11, fontWeight: 700, color: C.white, background: tc, padding: "4px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em", backdropFilter: "blur(4px)" }}>{b.tag}</span>
                  {/* Read time — top right */}
                  <span style={{ position: "absolute", bottom: 14, right: 14, fontSize: 11, fontWeight: 600, color: C.white, background: "rgba(0,0,0,0.35)", padding: "4px 10px", borderRadius: 20, backdropFilter: "blur(4px)" }}>{b.readTime}</span>
                </div>
                {/* Card content */}
                <div style={{ padding: "20px 24px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginBottom: 8 }}>{b.date}</span>
                  <h4 style={{ fontSize: 17, fontWeight: 700, color: C.green, lineHeight: 1.4, marginBottom: 10 }}>{b.title}</h4>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, flex: 1 }}>{b.excerpt}</p>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tc, marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>Read Article →</span>
                </div>
              </Card>
            );
          }} />

          {/* Newsletter */}
          <FadeIn delay={0.2}>
            <div style={{ marginTop: 64, background: `linear-gradient(135deg, ${C.green}08, ${C.brown}06)`, borderRadius: 20, padding: "48px 40px", textAlign: "center", border: `1px solid ${C.warmGray}50`, maxWidth: 680, marginInline: "auto" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.green, marginBottom: 10 }}>Stay Connected</h3>
              <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 28, lineHeight: 1.6 }}>Subscribe to our newsletter for updates on research, events, and stories from the Saathban community.</p>
              {subbed ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.green, fontWeight: 600, fontSize: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  You're subscribed — welcome to the community!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, maxWidth: 440, width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
                    <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ flex: "1 1 240px", padding: "14px 20px", borderRadius: 50, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.white, color: C.textMain, minWidth: 200 }} />
                    <Btn onClick={async () => {
                      setSubEmailError("");
                      if (!isValidEmail(email)) { setSubEmailError("Please enter a valid email address."); return; }
                      setSubLoading(true);
                      const fd = new FormData(); fd.append("type", "newsletter"); fd.append("email", email);
                      await fetch(SOCIAL_LINKS.script, { method: "POST", mode: "no-cors", body: fd });
                      setSubbed(true); setSubLoading(false);
                    }}>{subLoading ? "Subscribing..." : "Subscribe"}</Btn>
                  </div>
                  {subEmailError && <p style={{ fontSize: 12, color: C.brown, margin: 0 }}>{subEmailError}</p>}
                  {subError && <p style={{ fontSize: 13, color: C.brown, margin: 0 }}>Something went wrong — email us at <a href="mailto:hr@saathban.com" style={{ color: C.brown }}>hr@saathban.com</a></p>}
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ CONTACT ═══════════ */}
      <section id="contact" className="section-pad" style={{ padding: "100px 0", background: C.bg }}>
        <div style={px}>
          <SecTitle sub="Have questions, ideas, or want to collaborate? We'd love to hear from you.">Contact Us</SecTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, maxWidth: 920, margin: "0 auto", alignItems: "start" }} className="mission-grid">
            <FadeIn>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.green, marginBottom: 24 }}>Reach Out</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {[
                    { href: `mailto:${SOCIAL_LINKS.email}`, label: "Email", value: SOCIAL_LINKS.email, color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg> },
                    { href: SOCIAL_LINKS.instagram, label: "Instagram", value: "@saathban", color: C.brown, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.brown} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill={C.brown}/></svg> },
                    { href: SOCIAL_LINKS.facebook, label: "Facebook", value: "Saathban", color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                    { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", value: "Saathban", color: C.green, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
                  ].map(({ href, label, value, color, icon }) => (
                    <a key={label} href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer" style={{ display: "flex", gap: 16, alignItems: "center", textDecoration: "none" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 15, color, fontWeight: 500 }}>{value}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <Card>
                {sent ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${C.green}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <h4 style={{ fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 8 }}>Message Sent!</h4>
                    <p style={{ fontSize: 14, color: C.textMuted }}>We'll get back to you soon at {contact.email}.</p>
                    <span onClick={() => { setSent(false); setContact({ name: "", email: "", message: "", contactType: "General" }); }}
                      style={{ fontSize: 13, color: C.brown, cursor: "pointer", marginTop: 12, display: "inline-block", fontWeight: 600 }}>Send another message</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ fontSize: 18, fontWeight: 700, color: C.green }}>Send Us a Message</h4>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["General", "Volunteer", "Partner"].map(t => (
                          <span key={t} onClick={() => setContact(c => ({ ...c, contactType: t }))}
                            style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, cursor: "pointer", background: contact.contactType === t ? C.green : `${C.warmGray}60`, color: contact.contactType === t ? C.cream : C.textMuted, transition: "all 0.2s ease" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <input placeholder="Your Name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg }} />
                    <input type="email" placeholder="Your Email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${emailError ? C.brown : C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg }} />
                    {emailError && <p style={{ fontSize: 12, color: C.brown, marginTop: -10, marginBottom: -4 }}>{emailError}</p>}
                    <textarea placeholder="Your Message" rows={4} value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })}
                      style={{ padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${C.warmGray}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: C.bg, resize: "vertical" }} />
                    <Btn onClick={async () => {
                      setEmailError("");
                      if (!contact.name || !contact.email || !contact.message) return;
                      if (!isValidEmail(contact.email)) { setEmailError("Please enter a valid email address."); return; }
                      const fd = new FormData();
                      fd.append("type", "contact"); fd.append("name", contact.name);
                      fd.append("email", contact.email); fd.append("message", contact.message);
                      fd.append("contactType", contact.contactType);
                      await fetch(SOCIAL_LINKS.script, { method: "POST", mode: "no-cors", body: fd });
                      setSent(true);
                    }}>Send Message</Btn>
                  </div>
                )}
              </Card>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ background: C.green, color: "rgba(250,243,233,0.7)", padding: "60px 0 32px" }}>
        <div style={px}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 40, marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid rgba(250,243,233,0.1)" }}>
            <div style={{ maxWidth: 280 }}>
              <div style={{ marginBottom: 14 }}>
                <img src="/logo-extended-light.png" alt="Saathban" style={{ height: 48, width: "auto", filter: "brightness(10)" }} />
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>A vibrant ecosystem where generations flourish together. Wisdom inherited, life shared, every age thriving as one.</p>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Quick Links</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {NAV_ITEMS.map(n => (
                  <span key={n.id} onClick={() => scrollTo(n.id)} style={{ cursor: "pointer", fontSize: 14, transition: "color 0.3s" }}
                    onMouseEnter={e => e.target.style.color = C.cream} onMouseLeave={e => e.target.style.color = "rgba(250,243,233,0.7)"}>{n.label}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Connect</h4>
              <div style={{ display: "flex", gap: 12 }}>
                <SocialIcon href={`mailto:${SOCIAL_LINKS.email}`} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.instagram} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.facebook} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>} />
                <SocialIcon href={SOCIAL_LINKS.linkedin} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.cream} strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 13, color: "rgba(250,243,233,0.4)" }}>
            <span>© 2026 Saathban — Timeless Togetherness. All rights reserved.</span>
            <span style={{ fontSize: 12 }}>Where generations flourish together.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
