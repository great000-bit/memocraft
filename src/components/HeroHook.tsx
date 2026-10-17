import { InlineScript } from "./InlineScript";
import styles from "./HeroHook.module.css";

// The landing headline: one short hook, a different one on each visit. The second half is in teal.
const hooks: [string, string][] = [
  ["Did they get the files?", "Now you’ll know."],
  ["Send it once.", "Know it landed."],
  ["One link.", "Every file."],
  ["Delivered.", "And you can prove it."],
  ["No more zip files.", "Just one link."],
  ["Your work,", "handed over properly."],
  ["Stop asking", "“did you get it?”"],
  ["The handover is", "part of the work."],
  ["Big files.", "One tidy link."],
  ["Opened. Downloaded.", "You’ll see both."],
  ["Send the files.", "Skip the follow-up."],
  ["Every file labelled.", "Every client clear."],
  ["Made for your", "client’s phone."],
  ["Finished work,", "delivered beautifully."],
  ["Your name first.", "Your files, delivered."],
];

// Every hook is in the page and the stylesheet shows one. Before the first paint a small script picks which, never
// the same as the visitor's last one, so there is no flash of a different headline. Without the script, or after a
// soft navigation, the first hook shows.
const pick = `try{var h=document.currentScript.parentElement,n=${hooks.length},k="mc-hook",l=-1;try{l=+sessionStorage.getItem(k)}catch(e){}var i=Math.floor(Math.random()*(n-1));if(i>=l&&l>=0)i++;h.setAttribute("data-pick",i);try{sessionStorage.setItem(k,i)}catch(e){}}catch(e){}`;

export function HeroHook({ className = "", accentClassName = "" }: { className?: string; accentClassName?: string }) {
  return (
    <h1 className={`${className} ${styles.hooks}`} suppressHydrationWarning>
      <InlineScript html={pick} />
      {hooks.map(([lead, accent], index) => (
        <span key={index} className={styles.hook}>
          {lead} <span className={accentClassName}>{accent}</span>
        </span>
      ))}
    </h1>
  );
}
