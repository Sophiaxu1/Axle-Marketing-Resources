import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { brands, type BrandData, type LogoVariant, getAssetUrl, getDownloadUrl } from "@/lib/brand-data";
import { downloadFile } from "@/lib/utils";
import { useImageLibrary } from "@/hooks/useImageLibrary";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  ImageIcon,
  Type,
  FileText,
  Palette,
  Images,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import NotFound from "./not-found";

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function ColorSwatch({ name, hex }: { name: string; hex: string }) {
  const [copied, setCopied] = useState(false);
  const light = isLightColor(hex);

  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="group flex items-stretch rounded-md border border-border overflow-hidden cursor-pointer"
      onClick={handleCopy}
      data-testid={`swatch-${hex.replace("#", "")}`}
    >
      <div
        className="w-20 h-20 flex-shrink-0 flex items-center justify-center relative"
        style={{ background: hex }}
      >
        <span
          className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: light ? "#17052E" : "#FFFFFF" }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </span>
      </div>
      <div className="flex flex-col justify-center px-4 py-3">
        <span className="text-sm font-semibold" data-testid={`text-color-name-${hex.replace("#", "")}`}>
          {name}
        </span>
        <span className="text-xs font-mono text-muted-foreground" data-testid={`text-color-hex-${hex.replace("#", "")}`}>
          {hex}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function LogoCard({ logo, idx }: { logo: LogoVariant; idx: number }) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div
          className="w-full h-28 rounded-md mb-4 flex items-center justify-center p-4"
          style={{ background: logo.previewBg || "#fafafa" }}
        >
          {logo.file ? (
            <img
              src={getAssetUrl(logo.file)}
              alt={logo.name}
              className="max-h-16 max-w-full object-contain"
              style={logo.scale ? { transform: `scale(${logo.scale})` } : undefined}
            />
          ) : (
            <span className="text-sm font-medium" style={{ opacity: 0.5 }}>
              {logo.name}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium" data-testid={`text-logo-name-${idx}`}>
            {logo.name}
          </span>
          {logo.file ? (
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-download-logo-${idx}`}
              onClick={() => downloadFile(getDownloadUrl(logo.file!), decodeURIComponent(logo.file!.split("/").pop() || logo.name))}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
          ) : (
            <Button size="sm" variant="outline" data-testid={`button-download-logo-${idx}`}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
          )}
        </div>
        {logo.note && (
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            {logo.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DynamicImageLibrary({ brandId }: { brandId: string }) {
  const { images, loading } = useImageLibrary(brandId);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12 text-muted-foreground"
        data-testid="image-library-loading"
      >
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        <span className="text-sm">Loading images…</span>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="image-library-empty">
        No images found in this library yet.
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
      data-testid="image-library-grid"
    >
      {images.map((image, i) => (
        <Card key={image.url} className="border-border overflow-hidden group">
          <div className="aspect-[4/3] bg-muted relative flex items-center justify-center overflow-hidden">
            <img
              src={image.url}
              alt={image.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <CardContent className="p-3">
            <p
              className="text-xs font-medium truncate mb-2"
              title={image.name}
              data-testid={`text-asset-name-${i}`}
            >
              {image.name}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              data-testid={`button-download-asset-${i}`}
              onClick={() => downloadFile(image.downloadUrl, image.name)}
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

function fontWeight(variant: string): number {
  if (variant.toLowerCase().includes("bold")) return 700;
  return 400;
}

function fontStyle(variant: string): "italic" | "normal" {
  if (variant.toLowerCase().includes("italic")) return "italic";
  return "normal";
}

export default function BrandKit() {
  const [, params] = useRoute("/brand-kit/:brandId");
  const brandId = params?.brandId || "";
  const brand: BrandData | undefined = brands[brandId];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [brandId]);

  if (!brand) return <NotFound />;

  return (
    <div className="min-h-screen bg-background" data-testid={`page-brand-${brandId}`}>
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.15) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-20">
          {(() => {
            const isLightHero = brand.gradientTo === "#FFFFFF" || brand.gradientTo === "#ffffff";
            const textColor = isLightHero ? brand.primaryColor : "#ffffff";
            const subtextColor = isLightHero ? `${brand.primaryColor}99` : "rgba(255,255,255,0.65)";
            const backColor = isLightHero ? `${brand.primaryColor}b3` : "rgba(255,255,255,0.7)";
            const btnClass = isLightHero
              ? `border-[${brand.primaryColor}]/30 text-[${brand.primaryColor}] backdrop-blur-sm no-default-hover-elevate no-default-active-elevate`
              : "bg-white/10 border-white/20 text-white backdrop-blur-sm no-default-hover-elevate no-default-active-elevate";
            return (
              <>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium mb-6 transition-opacity"
                  style={{ color: backColor }}
                  data-testid="link-back-home"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Marketing Resources
                </Link>
                <motion.h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight"
                  style={{ color: textColor }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  data-testid="text-brand-title"
                >
                  {brand.name}
                </motion.h1>
                <motion.p
                  className="text-base md:text-lg max-w-xl"
                  style={{ color: subtextColor }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  data-testid="text-brand-subtitle"
                >
                  Brand guidelines, assets, and resources
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mt-6"
                >
                  {brand.guidelinesFile ? (
                    <Button
                      variant="outline"
                      className={btnClass}
                      style={isLightHero ? { borderColor: `${brand.primaryColor}40`, color: brand.primaryColor } : undefined}
                      data-testid="button-download-guidelines"
                      onClick={() => downloadFile(getDownloadUrl(brand.guidelinesFile!), decodeURIComponent(brand.guidelinesFile!.split("/").pop() || `${brand.name}-brand-guidelines`))}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Download Brand Guidelines
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className={btnClass}
                      style={isLightHero ? { borderColor: `${brand.primaryColor}40`, color: brand.primaryColor } : undefined}
                      data-testid="button-download-guidelines"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Download Brand Guidelines
                    </Button>
                  )}
                </motion.div>
              </>
            );
          })()}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        <motion.section
          variants={sectionFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionHeader title="Logos" />
          {(() => {
            const hasGroups = brand.logos.some((l) => l.group);
            if (hasGroups) {
              const groups: { label: string; logos: typeof brand.logos }[] = [];
              brand.logos.forEach((logo) => {
                const groupLabel = logo.group || "Other";
                let group = groups.find((g) => g.label === groupLabel);
                if (!group) {
                  group = { label: groupLabel, logos: [] };
                  groups.push(group);
                }
                group.logos.push(logo);
              });
              let globalIdx = 0;
              return (
                <div className="space-y-8">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        {group.label}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {group.logos.map((logo) => {
                          const idx = globalIdx++;
                          return (
                            <LogoCard key={logo.name} logo={logo} idx={idx} />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {brand.logos.map((logo, i) => (
                  <LogoCard key={logo.name} logo={logo} idx={i} />
                ))}
              </div>
            );
          })()}
        </motion.section>

        <motion.section
          variants={sectionFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionHeader title="Typography" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {brand.fonts.map((font) => (
              <Card key={font.name} className="border-border">
                <CardContent className="p-6">
                  <div className="mb-5 space-y-1">
                    {font.variants.map((variant) => (
                      <p
                        key={variant}
                        className="text-lg leading-snug"
                        style={{
                          fontFamily: font.fontFamily,
                          fontWeight: fontWeight(variant),
                          fontStyle: fontStyle(variant),
                        }}
                        data-testid={`text-font-${font.name.replace(/\s/g, "-")}-${variant.replace(/\s/g, "-")}`}
                      >
                        {font.name} {variant}
                      </p>
                    ))}
                  </div>
                  <a
                    href={font.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-font-${font.name.replace(/\s/g, "-")}`}
                  >
                    <Button size="sm" variant="outline" className="w-full">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Download {font.name}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={sectionFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionHeader title="Templates" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {brand.templates.map((template, i) => (
              <Card key={template.name} className="border-border">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium" data-testid={`text-template-name-${i}`}>
                    {template.name}
                  </span>
                  {template.file ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-download-template-${i}`}
                      onClick={() => downloadFile(getDownloadUrl(template.file!), decodeURIComponent(template.file!.split("/").pop() || template.name))}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" data-testid={`button-download-template-${i}`}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={sectionFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionHeader title="Color Palette" />
          <div className="space-y-8">
            {brand.colorGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4" data-testid={`text-color-group-${group.label.replace(/\s/g, "-")}`}>
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.colors.map((color) => (
                    <ColorSwatch
                      key={color.hex}
                      name={color.name}
                      hex={color.hex}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={sectionFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <SectionHeader title="Image Library" />
          <DynamicImageLibrary brandId={brand.id} />
        </motion.section>
      </div>

      <footer className="border-t py-8 mt-8" data-testid="footer">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {brand.name} Brand Kit
          </span>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground inline-flex items-center gap-1.5"
            data-testid="link-footer-home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Marketing Resources
          </Link>
        </div>
      </footer>
    </div>
  );
}
