import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Product } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { productsApi } from '../lib/products';
import { ProductBoard, PRODUCT_STATUS_ORDER } from '../components/ProductBoard';
import { PlusIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './products.css';

// ── Products page ────────────────────────────────────────────────────────────

export function Products() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { current } = useWorkspace();
  const ws = current?.id;
  const [products, setProducts] = useState<Product[]>([]);

  useBreadcrumb(null);

  const refresh = useCallback(async () => {
    if (!ws) return;
    try {
      setProducts(await productsApi.list(ws));
    } catch {
      setProducts([]);
    }
  }, [ws]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="products-page">
      <div className="lin-toolbar">
        <h1 className="lin-toolbar-title">{t('products.title')}</h1>
        {products.length > 0 && (
          <span className="lin-toolbar-note">
            {t('products.trackedNote', { n: products.length, stages: PRODUCT_STATUS_ORDER.length })}
          </span>
        )}
        <button
          type="button"
          className="btn-primary btn-inline btn-sm"
          onClick={() => navigate('/products/new')}
        >
          <PlusIcon width={13} height={13} />
          <span>{t('products.addProduct')}</span>
        </button>
      </div>

      <ProductBoard products={products} onOpen={(p) => navigate(`/products/${p.id}`)} />
    </div>
  );
}
