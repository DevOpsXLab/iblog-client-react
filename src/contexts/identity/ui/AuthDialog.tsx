import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Wordmark } from "@/app/layout/Logo";
import { track } from "@/shared/analytics";
import { publicConfigQuery } from "@/shared/config";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Field, inputCls as input, PasswordInput as Password, ServerError } from "@/shared/ui/form";
import { Lens } from "@/shared/ui/modal";
import { Turnstile } from "@/shared/ui/turnstile";
import { authDialog, useAuthDialog } from "../application/authDialog";
import { useLogin, useLoginMfa, useRegister } from "../application/session";
import { type LoginInput, loginInputSchema, mfaInputSchema, type RegisterInput, registerInputSchema } from "../domain/account";

function SignIn({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [mfa, setMfa] = useState<string | null>(null);
  const login = useLogin();
  const verify = useLoginMfa();
  const f = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), defaultValues: { login: "", password: "" } });
  const m = useForm<{ code: string }>({ resolver: zodResolver(mfaInputSchema), defaultValues: { code: "" } });
  if (mfa)
    return (
      <form noValidate className="space-y-4" onSubmit={m.handleSubmit((v) => verify.mutate({ mfaToken: mfa, code: v.code }, { onSuccess: onDone }))}>
        <ServerError error={verify.error} />
        <Field label={t("auth.code")} error={m.formState.errors.code?.message} hint={t("auth.mfaHint")}>
          {(a) => (
            <input
              {...a}
              className={cn(input, "h-9 font-mono text-[20px] tracking-[0.4em] tabular-nums")}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              {...m.register("code")}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full justify-between" loading={verify.isPending}>
          {t("auth.verify")}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Button>
      </form>
    );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={f.handleSubmit((v) => login.mutate(v, { onSuccess: (r) => (r.kind === "mfa" ? setMfa(r.mfaToken) : onDone()) }))}
    >
      <ServerError error={login.error} />
      <Field label={t("auth.emailOrUsername")} error={f.formState.errors.login?.message}>
        {(a) => <input {...a} className={input} autoComplete="username" autoFocus {...f.register("login")} />}
      </Field>
      <Field label={t("auth.password")} error={f.formState.errors.password?.message}>
        {(a) => <Password {...a} autoComplete="current-password" {...f.register("password")} />}
      </Field>
      <Button type="submit" size="lg" className="w-full justify-between" loading={login.isPending}>
        {t("auth.signIn")}
        <ArrowRightIcon className="size-4" aria-hidden />
      </Button>
      <Link
        to="/forgot-password"
        onClick={() => authDialog.close()}
        className="block w-fit font-mono text-[12px] text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
      >
        {t("auth.forgot")}
      </Link>
    </form>
  );
}

function SignUp({ onDone }: { onDone: () => void }) {
  const t = useT();
  const reg = useRegister();
  const siteKey = useQuery(publicConfigQuery()).data?.captcha_site_key ?? "";
  const [captcha, setCaptcha] = useState("");
  const [captchaMissing, setCaptchaMissing] = useState(false);
  const [website, setWebsite] = useState("");
  useEffect(() => track({ name: "signup_open" }), []);
  const f = useForm<RegisterInput>({ resolver: zodResolver(registerInputSchema), defaultValues: { username: "", email: "", password: "" } });
  const e = f.formState.errors;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={f.handleSubmit((v) => {
        if (siteKey && !captcha) {
          setCaptchaMissing(true);
          return;
        }
        reg.mutate({ ...v, captcha_token: captcha || undefined, website: website || undefined }, { onSuccess: onDone });
      })}
    >
      <ServerError error={reg.error} />
      <Field label={t("auth.username")} error={e.username?.message}>
        {(a) => <input {...a} className={input} autoComplete="username" autoFocus {...f.register("username")} />}
      </Field>
      <Field label={t("auth.email")} error={e.email?.message}>
        {(a) => <input {...a} type="email" className={input} autoComplete="email" {...f.register("email")} />}
      </Field>
      <Field label={t("auth.password")} error={e.password?.message}>
        {(a) => <Password {...a} autoComplete="new-password" {...f.register("password")} />}
      </Field>
      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-px w-px opacity-0"
        value={website}
        onChange={(ev) => setWebsite(ev.target.value)}
      />
      {siteKey ? (
        <div className="rounded-[var(--radius-sm)] border border-line p-2">
          <Turnstile
            siteKey={siteKey}
            onToken={(tok) => {
              setCaptcha(tok);
              if (tok) setCaptchaMissing(false);
            }}
          />
          {captchaMissing ? (
            <p role="alert" className="mt-1 font-mono text-[12px] text-danger">
              {t("auth.captchaRequired")}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" size="lg" className="w-full justify-between" loading={reg.isPending}>
        {t("auth.signUp")}
        <ArrowRightIcon className="size-4" aria-hidden />
      </Button>
    </form>
  );
}

function Agreement() {
  const t = useT();
  const [before, rest] = t("auth.agree").split("{terms}");
  const [middle, after] = (rest ?? "").split("{privacy}");
  const link = "underline decoration-line-strong underline-offset-4 hover:text-fg";
  return (
    <p className="mt-auto max-w-[380px] pt-8 font-mono text-[11px] leading-5 text-muted">
      {before}
      <Link to="/terms" className={link} onClick={() => authDialog.close()}>
        {t("legal.terms")}
      </Link>
      {middle}
      <Link to="/privacy" className={link} onClick={() => authDialog.close()}>
        {t("legal.privacy")}
      </Link>
      {after}
    </p>
  );
}

export function AuthDialog() {
  const t = useT();
  const mode = useAuthDialog();
  return (
    <Dialog.Root open={mode !== null} onOpenChange={(o) => !o && authDialog.close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content className="dialog-pop fixed inset-0 z-50 grid grid-rows-[auto_1fr] overflow-y-auto bg-card md:inset-auto md:top-1/2 md:left-1/2 md:h-[560px] md:w-[880px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:grid-cols-[320px_1fr] md:grid-rows-1 md:overflow-hidden md:rounded-[var(--radius-md)] md:border md:border-line-strong md:shadow-[6px_6px_0_0_var(--fg)]">
          <aside
            aria-hidden
            className="flex h-14 items-center gap-3 bg-inverse px-5 text-on-inverse md:h-auto md:flex-col md:items-stretch md:justify-between md:p-7"
          >
            <Wordmark className="text-[18px] [&>span:first-child]:bg-on-inverse [&>span:first-child]:text-inverse" />
            <ol className="hidden space-y-3 font-mono text-[12px] md:block">
              <li className="text-[11px] tracking-[0.12em] uppercase opacity-60">{mode === "signup" ? t("auth.specNew") : t("auth.specAccess")}</li>
              <li>
                <span className="opacity-60">01</span> {t("auth.spec1")}
              </li>
              <li>
                <span className="opacity-60">02</span> {t("auth.spec2")}
              </li>
              <li>
                <span className="opacity-60">03</span> {t("auth.spec3")}
              </li>
            </ol>
            <div className="hidden h-24 rounded-[var(--radius-sm)] opacity-20 [background:repeating-linear-gradient(-45deg,var(--on-inverse)_0_1px,transparent_1px_8px)] md:block" />
          </aside>
          <div className="relative flex flex-col px-6 py-8 md:overflow-y-auto md:px-12 md:py-10">
            <div className="flex items-center justify-between gap-3">
              <Lens
                label={t("auth.account")}
                value={mode === "signup" ? "signup" : "signin"}
                onChange={(v) => authDialog.open(v)}
                items={[
                  ["signin", t("auth.signIn")],
                  ["signup", t("auth.createOne")],
                ]}
              />
              <Dialog.Close asChild>
                <Button variant="ghost-icon" aria-label={t("auth.close")}>
                  <XIcon aria-hidden />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="mt-8 font-display text-[26px] leading-8 font-bold tracking-[-0.03em]">
              {mode === "signup" ? t("auth.join") : t("auth.welcomeBack")}
            </Dialog.Title>
            <Dialog.Description className="sr-only">{mode === "signup" ? t("auth.createAccount") : t("auth.signInToAccount")}</Dialog.Description>
            <div className="mt-6 w-full max-w-[380px]">{mode === "signup" ? <SignUp onDone={authDialog.close} /> : <SignIn onDone={authDialog.close} />}</div>
            <Agreement />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
